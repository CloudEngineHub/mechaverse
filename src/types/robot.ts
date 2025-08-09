export interface UrdfData {
  name?: string;
  description?: string;
  mass?: number;
  dofs?: number;
  joints?: {
    revolute?: number;
    prismatic?: number;
    continuous?: number;
    fixed?: number;
    other?: number;
  };
  links?: {
    name?: string;
    mass?: number;
  }[];
  materials?: {
    name?: string;
    percentage?: number;
  }[];
  // Add id and files for compatibility
  id?: string;
  files?: any[];
}

export interface RobotFileModel {
  path: string;
  blobUrl: string;
  name?: string;
}

export type RobotFileType = "URDF" | "MJCF" | "SDF" | "USD";

export interface ExampleRobot {
  name: string;
  fileType: RobotFileType;
  path?: string;
  imagePath?: string;
}

export interface RobotFile {
  type: RobotFileType;
  file: RobotFileModel;
}

// Robot table structure from Supabase
export interface Robot {
  repo_owner: string;
  repo_name: string;
  updated_at: string;
  github_url: string | null;
  visibility: string; // This should be visibility_type but we need the enum definition
  more_info_link: string | null;
  urdf_url: string | null;
  display_name: string | null;
  created_at: string;
  image_url: string | null;
  description: string | null;
  sdk_languages: string[] | null;
  tags: string[] | null;
}
