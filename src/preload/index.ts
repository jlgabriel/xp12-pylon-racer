// The only privileged bridge: RacerApi as thin ipcRenderer calls, exposed as window.racer. Adding a
// method here means adding its handler in main/ipc.ts on the same channel.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { ImportReport, LiveUpdate, RacerApi, RunSummary } from "../shared/racerApi";

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, value: T): void => listener(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const racer: RacerApi = {
  getAppInfo: () => ipcRenderer.invoke("racer:getAppInfo"),
  setPilot: (name) => ipcRenderer.invoke("racer:setPilot", name),
  removePilot: (name) => ipcRenderer.invoke("racer:removePilot", name),
  chooseXplaneDir: () => ipcRenderer.invoke("racer:chooseXplaneDir"),
  setAircraftClass: (aircraftId, classId) => ipcRenderer.invoke("racer:setAircraftClass", aircraftId, classId),
  setPrefs: (patch) => ipcRenderer.invoke("racer:setPrefs", patch),
  listCourses: () => ipcRenderer.invoke("racer:listCourses"),
  getCourse: (id) => ipcRenderer.invoke("racer:getCourse", id),
  importFiles: () => ipcRenderer.invoke("racer:importFiles"),
  importDropped: (files) => ipcRenderer.invoke("racer:importDropped", files),
  exportCourse: (id) => ipcRenderer.invoke("racer:exportCourse", id),
  saveCourse: (draft) => ipcRenderer.invoke("racer:saveCourse", draft),
  duplicateCourse: (id) => ipcRenderer.invoke("racer:duplicateCourse", id),
  deleteCourse: (id) => ipcRenderer.invoke("racer:deleteCourse", id),
  installCourse: (id) => ipcRenderer.invoke("racer:installCourse", id),
  uninstallCourse: (id) => ipcRenderer.invoke("racer:uninstallCourse", id),
  searchPlaces: (query) => ipcRenderer.invoke("racer:searchPlaces", query),
  selectCourse: (id) => ipcRenderer.invoke("racer:selectCourse", id),
  resetRace: () => ipcRenderer.invoke("racer:resetRace"),
  startDemo: () => ipcRenderer.invoke("racer:startDemo"),
  stopDemo: () => ipcRenderer.invoke("racer:stopDemo"),
  listRuns: (courseId) => ipcRenderer.invoke("racer:listRuns", courseId),
  getRun: (id) => ipcRenderer.invoke("racer:getRun", id),
  takeOpenedFiles: () => ipcRenderer.invoke("racer:takeOpenedFiles"),
  onLive: (listener) => subscribe<LiveUpdate>("racer:live", listener),
  onRunSaved: (listener) => subscribe<RunSummary>("racer:runSaved", listener),
  onImported: (listener) => subscribe<ImportReport>("racer:imported", listener),
};

contextBridge.exposeInMainWorld("racer", racer);
