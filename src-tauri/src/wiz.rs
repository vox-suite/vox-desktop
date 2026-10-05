use crate::auth::AuthManager;
use futures_util::future::join_all;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    net::{Ipv4Addr, SocketAddr},
    path::{Path, PathBuf},
    time::Duration,
};
use tauri::{AppHandle, Manager, State};
use tokio::{
    net::UdpSocket,
    sync::Mutex,
    time::{timeout, Instant},
};

const PORT: u16 = 38899;
const LIMIT: usize = 32;
const WAIT: Duration = Duration::from_secs(2);

#[derive(Default)]
pub struct WizState(Mutex<()>);

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WizDevice {
    pub id: String,
    pub name: String,
    pub address: String,
    pub on: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub brightness: Option<u8>,
    pub reachable: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub room: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub temp_range: Option<[u16; 2]>,
}

#[derive(Default, Serialize, Deserialize)]
pub struct WizStatus {
    pub enabled: bool,
    pub devices: Vec<WizDevice>,
}

fn user(auth: &AuthManager) -> Result<String, String> {
    let state = auth.state();
    if !state.signed_in {
        return Err("Sign in to use WiZ.".into());
    }
    state
        .user_id
        .filter(|id| !id.is_empty())
        .ok_or_else(|| "Sign in to use WiZ.".into())
}

fn same_user(auth: &AuthManager, expected: &str) -> Result<(), String> {
    if user(auth)? != expected {
        return Err("Your signed-in account changed. Try again.".into());
    }
    Ok(())
}

fn private_address(input: &str) -> Result<Ipv4Addr, String> {
    let ip: Ipv4Addr = input
        .parse()
        .map_err(|_| "Enter a private IPv4 address, such as 192.168.1.20.")?;
    if !ip.is_private() || ip.octets()[3] == 0 || ip.octets()[3] == 255 {
        return Err("WiZ devices must use a private local IPv4 address.".into());
    }
    Ok(ip)
}

fn state_path(app: &AppHandle, account: &str) -> Result<PathBuf, String> {
    let hash = format!("{:x}", Sha256::digest(account.as_bytes()));
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("wiz")
        .join(format!("{hash}.json")))
}

fn load(path: &Path) -> Result<WizStatus, String> {
    match std::fs::read(path) {
        Ok(data) => {
            if data.len() > 65536 {
                return Err("Stored WiZ configuration is too large.".into());
            }
            let status: WizStatus = serde_json::from_slice(&data)
                .map_err(|_| "Stored WiZ configuration is invalid.")?;
            if status.devices.len() > LIMIT {
                return Err("Too many stored WiZ devices.".into());
            }
            for device in &status.devices {
                private_address(&device.address)?;
            }
            Ok(status)
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(WizStatus::default()),
        Err(e) => Err(format!("Could not read WiZ configuration: {e}")),
    }
}

fn save(path: &Path, status: &WizStatus) -> Result<(), String> {
    let parent = path.parent().ok_or("Invalid WiZ configuration path.")?;
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let temporary = parent.join(format!("{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        use std::io::Write;
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&temporary).map_err(|e| e.to_string())?;
        file.write_all(&serde_json::to_vec(status).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        std::fs::rename(&temporary, path).map_err(|e| e.to_string())
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&temporary);
    }
    result
}

fn enabled(status: &WizStatus) -> Result<(), String> {
    if !status.enabled {
        return Err("Connect WiZ and allow local network access first.".into());
    }
    Ok(())
}

fn parse_pilot(data: &[u8], address: &str) -> Result<WizDevice, String> {
    let response: Value = serde_json::from_slice(data).map_err(|_| "Invalid WiZ response.")?;
    if response.get("method").and_then(Value::as_str) != Some("getPilot")
        || response.get("error").is_some()
    {
        return Err("Unexpected WiZ response.".into());
    }
    let result = response.get("result").ok_or("Missing WiZ status.")?;
    let mac = result
        .get("mac")
        .and_then(Value::as_str)
        .ok_or("Missing WiZ device identity.")?;
    let id = mac.replace([':', '-'], "").to_lowercase();
    if id.len() != 12 || !id.bytes().all(|v| v.is_ascii_hexdigit()) || id == "000000000000" {
        return Err("Invalid WiZ device identity.".into());
    }
    let on = result
        .get("state")
        .and_then(Value::as_bool)
        .ok_or("Missing WiZ power state.")?;
    let brightness = match result.get("dimming") {
        None => None,
        Some(v) => Some(
            v.as_u64()
                .filter(|v| *v <= 100)
                .ok_or("Invalid WiZ brightness.")? as u8,
        ),
    };
    let name = format!("WiZ light {}", &id[6..]);
    Ok(WizDevice {
        id,
        name,
        address: address.into(),
        on,
        brightness,
        reachable: true,
        room: None,
        temp_range: None,
    })
}

async fn request(target: SocketAddr, method: &str, params: Value) -> Result<Vec<u8>, String> {
    let socket = UdpSocket::bind((Ipv4Addr::UNSPECIFIED, 0))
        .await
        .map_err(|e| e.to_string())?;
    socket.connect(target).await.map_err(|e| e.to_string())?;
    socket
        .send(
            &serde_json::to_vec(&json!({"method":method,"params":params}))
                .map_err(|e| e.to_string())?,
        )
        .await
        .map_err(|e| e.to_string())?;
    timeout(WAIT, async {
        let mut buffer = [0u8; 4096];
        for _ in 0..16 {
            let length = socket.recv(&mut buffer).await.map_err(|e| e.to_string())?;
            if length == buffer.len() {
                continue;
            }
            let Ok(response) = serde_json::from_slice::<Value>(&buffer[..length]) else {
                continue;
            };
            if response.get("method").and_then(Value::as_str) != Some(method) {
                continue;
            }
            if response.get("error").is_some() {
                return Err("WiZ rejected the request.".into());
            }
            return Ok(buffer[..length].to_vec());
        }
        Err("No valid WiZ response.".into())
    })
    .await
    .map_err(|_| {
        "WiZ light did not respond. Check its power and local network access.".to_string()
    })?
}

async fn read_device(address: &str) -> Result<WizDevice, String> {
    let ip = private_address(address)?;
    let data = request(SocketAddr::from((ip, PORT)), "getPilot", json!({})).await?;
    parse_pilot(&data, address)
}

async fn discover() -> Result<Vec<WizDevice>, String> {
    let socket = UdpSocket::bind((Ipv4Addr::UNSPECIFIED, 0))
        .await
        .map_err(|e| e.to_string())?;
    socket.set_broadcast(true).map_err(|e| e.to_string())?;
    let payload =
        serde_json::to_vec(&json!({"method":"getPilot","params":{}})).map_err(|e| e.to_string())?;
    socket
        .send_to(&payload, (Ipv4Addr::BROADCAST, PORT))
        .await
        .map_err(|e| e.to_string())?;
    let deadline = Instant::now() + Duration::from_secs(3);
    let mut devices: Vec<WizDevice> = Vec::new();
    let mut buffer = [0u8; 4096];
    for _ in 0..256 {
        let Ok(result) = tokio::time::timeout_at(deadline, socket.recv_from(&mut buffer)).await
        else {
            break;
        };
        let (length, sender) = result.map_err(|e| e.to_string())?;
        if sender.port() != PORT || length == buffer.len() {
            continue;
        }
        let address = sender.ip().to_string();
        if private_address(&address).is_err() {
            continue;
        }
        if let Ok(device) = parse_pilot(&buffer[..length], &address) {
            if !devices.iter().any(|existing| existing.id == device.id) {
                devices.push(device);
            }
            if devices.len() == LIMIT {
                break;
            }
        }
    }
    devices.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(devices)
}

const HOME_HOST: &str = "wiz-s3-local-integration-prd-artifacts.s3.eu-west-1.amazonaws.com";

struct HomeLight {
    name: String,
    room: Option<String>,
    temp_range: Option<[u16; 2]>,
}

async fn fetch_home(link: &str) -> Result<HashMap<String, HomeLight>, String> {
    let url = reqwest::Url::parse(link.trim()).map_err(|_| "Paste the WiZ local integration link.")?;
    if url.scheme() != "https" || url.host_str() != Some(HOME_HOST) {
        return Err("Paste the local integration link from the WiZ app.".into());
    }
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|_| "Could not reach the WiZ link.")?;
    if !response.status().is_success() {
        return Err("The WiZ link has expired. Generate a new one in the WiZ app and try again.".into());
    }
    if response.content_length().is_some_and(|n| n > 65536) {
        return Err("The WiZ file is too large.".into());
    }
    let data = response.bytes().await.map_err(|e| e.to_string())?;
    if data.len() > 65536 {
        return Err("The WiZ file is too large.".into());
    }
    parse_home(&data)
}

fn parse_home(data: &[u8]) -> Result<HashMap<String, HomeLight>, String> {
    let home: Value = serde_json::from_slice(data).map_err(|_| "Invalid WiZ file.")?;
    let rooms: HashMap<u64, String> = home
        .get("rooms")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|r| Some((r.get("room_id")?.as_u64()?, r.get("name")?.as_str()?.to_string())))
        .collect();
    let mut lights = HashMap::new();
    for device in home.get("devices").and_then(Value::as_array).into_iter().flatten() {
        if device.get("type").and_then(Value::as_str) != Some("light") {
            continue;
        }
        let Some(mac) = device.get("mac_address").and_then(Value::as_str) else { continue };
        let id = mac.replace([':', '-'], "").to_lowercase();
        let range = device.pointer("/traits/white_range").and_then(|r| {
            let r = r.as_array()?;
            Some([u16::try_from(r.first()?.as_u64()?).ok()?, u16::try_from(r.get(1)?.as_u64()?).ok()?])
        });
        lights.insert(
            id,
            HomeLight {
                name: device.get("name").and_then(Value::as_str).unwrap_or("WiZ light").chars().take(64).collect(),
                room: device.get("room_id").and_then(Value::as_u64).and_then(|r| rooms.get(&r).cloned()),
                temp_range: range,
            },
        );
    }
    if lights.is_empty() {
        return Err("No lights found in the WiZ file.".into());
    }
    Ok(lights)
}

async fn refresh(status: &mut WizStatus) {
    let mut devices = join_all(status.devices.iter().map(|old| async move {
        match read_device(&old.address).await {
            Ok(mut device) if device.id == old.id => {
                device.name = old.name.clone();
                device.room = old.room.clone();
                device.temp_range = old.temp_range;
                device
            }
            _ => {
                let mut device = old.clone();
                device.reachable = false;
                device
            }
        }
    }))
    .await;
    if devices.iter().any(|d| !d.reachable) {
        let found = discover().await.unwrap_or_default();
        for device in devices.iter_mut().filter(|d| !d.reachable) {
            if let Some(f) = found.iter().find(|f| f.id == device.id) {
                device.address = f.address.clone();
                device.on = f.on;
                device.brightness = f.brightness;
                device.reachable = true;
            }
        }
    }
    status.devices = devices;
}

#[tauri::command]
pub async fn get_wiz_status(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    state: State<'_, WizState>,
) -> Result<WizStatus, String> {
    let _guard = state.0.lock().await;
    let account = user(&auth)?;
    let mut status = load(&state_path(&app, &account)?)?;
    if status.enabled {
        refresh(&mut status).await;
    }
    same_user(&auth, &account)?;
    Ok(status)
}

#[tauri::command]
pub async fn connect_wiz(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    state: State<'_, WizState>,
    consent: bool,
    link: String,
) -> Result<WizStatus, String> {
    let _guard = state.0.lock().await;
    let account = user(&auth)?;
    if !consent {
        return Err("Allow local network discovery and control to connect WiZ.".into());
    }
    let home = fetch_home(&link).await?;
    let mut devices = discover().await?;
    devices.retain(|device| home.contains_key(&device.id));
    for device in &mut devices {
        let light = &home[&device.id];
        device.name = light.name.clone();
        device.room = light.room.clone();
        device.temp_range = light.temp_range;
    }
    if devices.is_empty() {
        return Err("None of your WiZ lights were found on this network. Keep this computer on the same Wi-Fi and enable “Allow local communication” in the WiZ app.".into());
    }
    same_user(&auth, &account)?;
    let status = WizStatus {
        enabled: true,
        devices,
    };
    save(&state_path(&app, &account)?, &status)?;
    Ok(status)
}

#[tauri::command]
pub async fn refresh_wiz(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    state: State<'_, WizState>,
) -> Result<Vec<WizDevice>, String> {
    let _guard = state.0.lock().await;
    let account = user(&auth)?;
    let mut status = load(&state_path(&app, &account)?)?;
    enabled(&status)?;
    refresh(&mut status).await;
    same_user(&auth, &account)?;
    Ok(status.devices)
}

fn control_params(
    on: Option<bool>,
    brightness: Option<u8>,
    color: Option<[u8; 3]>,
    temp: Option<u16>,
) -> Result<Value, String> {
    if on.is_none() && brightness.is_none() && color.is_none() && temp.is_none() {
        return Err("Choose power, brightness, color or color temperature to change.".into());
    }
    if color.is_some() && temp.is_some() {
        return Err("Choose either a color or a color temperature, not both.".into());
    }
    if temp.is_some_and(|v| !(2200..=6500).contains(&v)) {
        return Err("Color temperature must be between 2200 and 6500 kelvin.".into());
    }
    if brightness.is_some_and(|v| v > 100) {
        return Err("Brightness must be between 0 and 100.".into());
    }
    if brightness == Some(0) && (on == Some(true) || color.is_some() || temp.is_some()) {
        return Err("Choose brightness above zero to turn the light on.".into());
    }
    let mut params = serde_json::Map::new();
    if let Some(on) = on {
        params.insert("state".into(), json!(on));
    }
    if let Some(value) = brightness {
        if value == 0 {
            params.insert("state".into(), json!(false));
        } else {
            params.insert("dimming".into(), json!(value));
        }
    }
    if let Some([r, g, b]) = color {
        params.insert("r".into(), json!(r));
        params.insert("g".into(), json!(g));
        params.insert("b".into(), json!(b));
    }
    if let Some(kelvin) = temp {
        params.insert("temp".into(), json!(kelvin));
    }
    Ok(Value::Object(params))
}

#[tauri::command]
pub async fn control_wiz(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    state: State<'_, WizState>,
    device_id: String,
    on: Option<bool>,
    brightness: Option<u8>,
    color: Option<[u8; 3]>,
    temp: Option<u16>,
) -> Result<WizDevice, String> {
    let _guard = state.0.lock().await;
    let account = user(&auth)?;
    let status = load(&state_path(&app, &account)?)?;
    enabled(&status)?;
    let device = status
        .devices
        .iter()
        .find(|device| device.id == device_id)
        .ok_or("This WiZ light is not connected to this account.")?;
    if let (Some(k), Some([lo, hi])) = (temp, device.temp_range) {
        if !(lo..=hi).contains(&k) {
            return Err(format!("{} supports {lo}-{hi} kelvin.", device.name));
        }
    }
    let params = control_params(on, brightness, color, temp)?;
    let verified = read_device(&device.address).await?;
    if verified.id != device.id {
        return Err("The device at this address changed. Reconnect WiZ.".into());
    }
    same_user(&auth, &account)?;
    let data = request(
        SocketAddr::from((private_address(&device.address)?, PORT)),
        "setPilot",
        params,
    )
    .await?;
    let response: Value =
        serde_json::from_slice(&data).map_err(|_| "Invalid WiZ control response.")?;
    if response.pointer("/result/success").and_then(Value::as_bool) != Some(true) {
        return Err("WiZ did not confirm the change.".into());
    }
    let mut updated = read_device(&device.address).await?;
    if updated.id != device.id {
        return Err("WiZ device identity changed.".into());
    }
    updated.name = device.name.clone();
    updated.room = device.room.clone();
    updated.temp_range = device.temp_range;
    same_user(&auth, &account)?;
    Ok(updated)
}

#[tauri::command]
pub async fn disconnect_wiz(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    state: State<'_, WizState>,
) -> Result<(), String> {
    let _guard = state.0.lock().await;
    let account = user(&auth)?;
    let path = state_path(&app, &account)?;
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("Could not disconnect WiZ: {e}")),
    }
}

pub async fn remote(app: &AppHandle, frame: &Value) -> Result<Value, String> {
    let auth = app.state::<AuthManager>();
    let state = app.state::<WizState>();
    match frame.get("action").and_then(Value::as_str) {
        Some("list") => {
            let status = get_wiz_status(app.clone(), auth, state).await?;
            enabled(&status)?;
            Ok(json!({ "ok": true, "devices": status.devices }))
        }
        Some("set") => {
            let device_id = frame
                .get("device_id")
                .and_then(Value::as_str)
                .ok_or("device_id is required.")?
                .to_string();
            let on = frame.get("on").and_then(Value::as_bool);
            let brightness = match frame.get("brightness").and_then(Value::as_u64) {
                Some(v) => Some(u8::try_from(v).map_err(|_| "Brightness must be between 0 and 100.")?),
                None => None,
            };
            let color = match frame.get("color").filter(|v| !v.is_null()) {
                Some(v) => Some(
                    serde_json::from_value::<[u8; 3]>(v.clone())
                        .map_err(|_| "color must be [r, g, b] with values 0-255.")?,
                ),
                None => None,
            };
            let temp = match frame.get("temp").and_then(Value::as_u64) {
                Some(v) => Some(u16::try_from(v).map_err(|_| "Invalid color temperature.")?),
                None => None,
            };
            let device =
                control_wiz(app.clone(), auth, state, device_id, on, brightness, color, temp)
                    .await?;
            Ok(json!({ "ok": true, "device": device }))
        }
        _ => Err("action must be list or set.".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_private_unicast_addresses() {
        for address in ["10.1.2.3", "172.16.2.3", "172.31.2.3", "192.168.1.2"] {
            assert!(private_address(address).is_ok());
        }
        for address in [
            "127.0.0.1",
            "8.8.8.8",
            "172.15.2.3",
            "172.32.2.3",
            "169.254.1.2",
            "255.255.255.255",
            "::1",
            "localhost",
            "10.0.0.0",
            "192.168.1.255",
            "192.168.1.2:38899",
        ] {
            assert!(private_address(address).is_err(), "{address}");
        }
    }

    #[test]
    fn pilot_requires_real_identity_and_state() {
        let device = parse_pilot(br#"{"method":"getPilot","result":{"mac":"AA:BB:CC:DD:EE:FF","state":true,"dimming":42}}"#, "192.168.1.2").unwrap();
        assert_eq!(device.id, "aabbccddeeff");
        assert_eq!(device.brightness, Some(42));
        assert_eq!(device.name, "WiZ light ddeeff");
        for payload in [
            "not json",
            r#"{"method":"setPilot","result":{"success":true}}"#,
            r#"{"method":"getPilot","result":{"state":true}}"#,
            r#"{"method":"getPilot","result":{"mac":"aabbccddeeff","state":true,"dimming":101}}"#,
        ] {
            assert!(parse_pilot(payload.as_bytes(), "192.168.1.2").is_err());
        }
    }

    #[test]
    fn permissions_and_precise_controls() {
        assert!(enabled(&WizStatus::default()).is_err());
        assert!(control_params(None, None, None, None).is_err());
        assert!(control_params(None, Some(101), None, None).is_err());
        assert!(control_params(Some(true), Some(0), None, None).is_err());
        assert_eq!(
            control_params(Some(false), None, None, None).unwrap(),
            json!({"state":false})
        );
        assert_eq!(
            control_params(None, Some(53), None, None).unwrap(),
            json!({"dimming":53})
        );
        assert_eq!(
            control_params(None, Some(0), None, None).unwrap(),
            json!({"state":false})
        );
    }

    #[test]
    fn color_and_temperature() {
        assert_eq!(
            control_params(None, None, Some([255, 0, 10]), None).unwrap(),
            json!({"r":255,"g":0,"b":10})
        );
        assert_eq!(
            control_params(None, None, None, Some(2700)).unwrap(),
            json!({"temp":2700})
        );
        assert!(control_params(None, None, Some([1, 2, 3]), Some(2700)).is_err());
        assert!(control_params(None, None, None, Some(2000)).is_err());
        assert!(control_params(None, None, None, Some(7000)).is_err());
        assert!(control_params(None, Some(0), Some([1, 2, 3]), None).is_err());
    }

    #[test]
    fn home_file_names_rooms_and_ranges() {
        let lights = parse_home(br#"{"udp_signing_key":"x","rooms":[{"room_id":1,"name":"Bedroom"}],"devices":[{"type":"light","room_id":1,"name":"B1","mac_address":"CC4085AE0294","traits":{"white_range":[2700,6500]}},{"type":"plug","mac_address":"aabbccddeeff"}]}"#).unwrap();
        assert_eq!(lights.len(), 1);
        let light = &lights["cc4085ae0294"];
        assert_eq!(light.name, "B1");
        assert_eq!(light.room.as_deref(), Some("Bedroom"));
        assert_eq!(light.temp_range, Some([2700, 6500]));
        assert!(parse_home(b"{}").is_err());
    }

    #[test]
    fn persisted_permission_is_separate_and_atomic() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let path = root.join("account.json");
        assert!(!load(&path).unwrap().enabled);
        save(
            &path,
            &WizStatus {
                enabled: true,
                devices: vec![],
            },
        )
        .unwrap();
        assert!(load(&path).unwrap().enabled);
        assert!(!load(&root.join("different-account.json")).unwrap().enabled);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                std::fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
        std::fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn udp_mock_control_has_no_scene_change_and_rejects_provider_errors() {
        let server = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let address = server.local_addr().unwrap();
        let task = tokio::spawn(async move {
            let mut buffer = [0; 4096];
            let (length, sender) = server.recv_from(&mut buffer).await.unwrap();
            let received: Value = serde_json::from_slice(&buffer[..length]).unwrap();
            assert_eq!(
                received,
                json!({"method":"setPilot","params":{"state":true,"dimming":62}})
            );
            server
                .send_to(br#"{"method":"getPilot","result":{"state":true}}"#, sender)
                .await
                .unwrap();
            server
                .send_to(br#"{"method":"setPilot","error":{"code":-1}}"#, sender)
                .await
                .unwrap();
        });
        assert!(request(
            address,
            "setPilot",
            control_params(Some(true), Some(62), None, None).unwrap()
        )
        .await
        .is_err());
        task.await.unwrap();
    }

    #[tokio::test]
    async fn udp_mock_returns_real_status_and_checks_method() {
        let server = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let address = server.local_addr().unwrap();
        let task = tokio::spawn(async move {
            let mut buffer = [0; 4096];
            let (length, sender) = server.recv_from(&mut buffer).await.unwrap();
            let received: Value = serde_json::from_slice(&buffer[..length]).unwrap();
            assert_eq!(received, json!({"method":"getPilot","params":{}}));
            server.send_to(b"malformed", sender).await.unwrap();
            server.send_to(br#"{"method":"getPilot","result":{"mac":"aabbccddeeff","state":false,"dimming":50}}"#, sender).await.unwrap();
        });
        let data = request(address, "getPilot", json!({})).await.unwrap();
        assert!(!parse_pilot(&data, "127.0.0.1").unwrap().on);
        task.await.unwrap();
    }
}
