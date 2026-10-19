type Start = (prompt: string) => void;
let active: { projectId: string; start: Start } | null = null;
export const diagramRequests = {
  register(projectId: string, start: Start) {
    const entry = { projectId, start };
    active = entry;
    return () => {
      if (active === entry) active = null;
    };
  },
  start(projectId: string, prompt: string) {
    if (active?.projectId !== projectId)
      throw new Error("Open the project before drawing a diagram");
    active.start(prompt);
  },
};
