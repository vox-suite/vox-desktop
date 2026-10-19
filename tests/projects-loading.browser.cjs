const {chromium, expect} = require('../../vox-web/node_modules/@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
(async()=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.goto('http://127.0.0.1:1421/screenshots.html?screen=home');
  await page.evaluate(async()=>{
   const {platform}=await import('/src/platform/index.ts');
   const http=platform().http;
   const original=http.request.bind(http);
   window.projectListState='loading';
   http.request=async req=>{
    if(req.path==='/v1/me/projects/count'){
     if(window.projectListState==='loading')await new Promise(resolve=>{window.releaseProjects=resolve});
     if(window.projectListState==='error')throw Error('Synthetic project load failure');
     return {count:window.projectListState==='empty'?0:1,rev:window.projectListState};
    }
    return original(req);
   };
  });
  await page.getByRole('button',{name:'Projects',exact:true}).click();
  await expect(page.getByRole('status',{name:'Loading projects',exact:true})).toBeVisible();
  await expect(page.getByText('A home for your project.',{exact:true})).toHaveCount(0);
  const output=path.resolve(__dirname,'../artifacts/project-loading');await fs.mkdir(output,{recursive:true});
  await page.screenshot({path:output+'/loading.png'});
  await page.evaluate(()=>{window.projectListState='populated';window.releaseProjects()});
  await expect(page.getByRole('status',{name:'Loading projects',exact:true})).toHaveCount(0);
  await expect(page.locator('button.project-list-row')).toHaveCount(1);
  await page.screenshot({path:output+'/results.png'});
  await page.getByRole('textbox',{name:'Find projects'}).fill('unmatched-project');
  await expect(page.getByRole('heading',{name:'No matching projects'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'No matching projects'}).locator('..').locator('svg')).toHaveCount(1);
  await page.screenshot({path:output+'/no-matches.png'});
  await page.getByRole('button',{name:'Clear search',exact:true}).click();
  await expect(page.locator('button.project-list-row')).toHaveCount(1);
  await page.evaluate(()=>{window.projectListState='loading'});
  await page.getByRole('button',{name:'Refresh projects',exact:true}).click();
  await expect(page.locator('button.project-list-row')).toHaveCount(1);
  await expect(page.getByRole('status',{name:'Loading projects',exact:true})).toHaveCount(0);
  await page.evaluate(()=>{window.projectListState='empty';window.releaseProjects()});
  await expect(page.getByText('A home for your project.',{exact:true})).toBeVisible();
  await expect(page.locator('button.project-list-row')).toHaveCount(0);
  await page.screenshot({path:output+'/empty.png'});
  await page.evaluate(()=>{window.projectListState='error'});
  await page.getByRole('button',{name:'Refresh projects',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Synthetic project load failure');
  await expect(page.getByText('A home for your project.',{exact:true})).toHaveCount(0);
  console.log('PASS: loading skeleton, results, illustrated empty/search states, clear search, refresh preservation, and error state');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
