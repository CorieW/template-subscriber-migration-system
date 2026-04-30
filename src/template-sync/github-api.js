export class GitHubApi {
  constructor({ token, baseUrl = "https://api.github.com", fetchImpl = globalThis.fetch } = {}) {
    this.token = token;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
  }

  async request(method, pathOrUrl, { body, accept = "application/vnd.github+json", raw = "json", headers = {} } = {}) {
    const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${this.baseUrl}${pathOrUrl}`;
    const requestHeaders = {
      Accept: accept,
      "User-Agent": "template-subscriber-migration-system",
      "X-GitHub-Api-Version": "2022-11-28",
      ...headers
    };
    let requestBody;
    if (body !== undefined) {
      if (Buffer.isBuffer(body) || typeof body === "string") {
        requestBody = body;
      } else {
        requestHeaders["Content-Type"] = "application/json";
        requestBody = JSON.stringify(body);
      }
    }
    if (this.token) {
      requestHeaders.Authorization = `Bearer ${this.token}`;
    }
    const response = await this.fetchImpl(url, {
      method,
      headers: requestHeaders,
      body: requestBody
    });
    const text = await response.text();
    if (!response.ok) {
      const error = new Error(`GitHub API ${method} ${url} failed (${response.status}): ${text}`);
      error.status = response.status;
      error.responseText = text;
      throw error;
    }
    if (raw === "text") {
      return text;
    }
    if (raw === "response") {
      return response;
    }
    return text ? JSON.parse(text) : null;
  }

  async paginate(path, query = {}) {
    const results = [];
    let page = 1;
    while (true) {
      const params = new URLSearchParams({ ...query, page: String(page) });
      const separator = path.includes("?") ? "&" : "?";
      const pageResults = await this.request("GET", `${path}${separator}${params.toString()}`);
      results.push(...pageResults);
      if (!Array.isArray(pageResults) || pageResults.length < Number(query.per_page || 30)) {
        break;
      }
      page += 1;
    }
    return results;
  }

  async uploadAsset(uploadUrlTemplate, name, data, contentType = "application/json") {
    const uploadUrl = uploadUrlTemplate.replace(/\{.*$/, "");
    const url = `${uploadUrl}?${new URLSearchParams({ name }).toString()}`;
    return this.request("POST", url, {
      body: data,
      accept: "application/vnd.github+json",
      headers: {
        "Content-Type": contentType
      }
    });
  }
}
