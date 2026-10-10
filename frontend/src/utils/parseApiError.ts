// Backend validation errors (422) come back as an array of objects
// ({loc, msg, type, ...}), not a string — rendering that array directly
// into JSX throws "Objects are not valid as a React child" and breaks
// the dialog instead of showing a message. This normalizes any shape
// FastAPI can return into a readable string.
export function parseApiError(err: any, fallback = "Unknown error."): string {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.message || fallback;

  if (Array.isArray(detail)) {
    return detail
      .map((d: any) => {
        const loc = Array.isArray(d?.loc)
          ? d.loc.filter((p: any) => p !== "body").join(".")
          : "";
        return loc ? `${loc}: ${d.msg}` : d.msg;
      })
      .join("\n");
  }

  return typeof detail === "string" ? detail : JSON.stringify(detail);
}
