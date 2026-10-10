// Super admins/master land on the platform overview (tenant list, stats) by
// default instead of their own largely-irrelevant tenant workspace dashboard.
export function getHomePath(user) {
  if (user?.role === "super_admin" || user?.role === "master") return "/admin";
  return "/dashboard";
}
