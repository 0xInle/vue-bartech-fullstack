export type Workspace = {
  company: { id: string; name: string };
  venue: { id: string; name: string };
  role: "bartender" | "senior_bartender" | "bar_manager" | "chef_bartender";
  roleLabel: string;
  scope: "company" | "venue";
  permissions: string[];
};

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  workplaces: Workspace[];
};
