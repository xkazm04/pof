export interface DirectoryEntry {
  name: string;
  path: string;
  hasUProject: boolean;
}

export interface DetectedProject {
  name: string;
  path: string;
  uprojectFile: string;
  engineVersion: string | null;
  validated: boolean;
}

export interface DetectedEngine {
  version: string;
  path: string;
}

export interface ListResponse {
  path: string;
  parent: string | null;
  directories: DirectoryEntry[];
  uprojectFiles: string[];
  isUEProject: boolean;
}

export interface PathBrowserProps {
  value: string;
  startFresh: boolean;
  onSelect: (path: string) => void;
  onProjectDetected?: (name: string, path: string) => void;
  onEngineDetected?: (version: string) => void;
}
