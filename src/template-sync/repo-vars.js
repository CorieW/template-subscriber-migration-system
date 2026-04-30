import { STATE_VARIABLES } from "./constants.js";
import { parseRepo } from "./utils.js";

export function blankSubscriberState() {
  return {
    [STATE_VARIABLES.lastHandled]: "",
    [STATE_VARIABLES.lastApplied]: "",
    [STATE_VARIABLES.lastDeclined]: "",
    [STATE_VARIABLES.upstreamRepo]: ""
  };
}

export function migrationMatchesHandledState(state, migrationId) {
  return [
    state[STATE_VARIABLES.lastHandled],
    state[STATE_VARIABLES.lastApplied],
    state[STATE_VARIABLES.lastDeclined]
  ].includes(migrationId);
}

export function applyStateTransition(state, transition, migrationId) {
  const next = { ...blankSubscriberState(), ...state };
  if (transition === "opened") {
    next[STATE_VARIABLES.lastHandled] = migrationId;
  } else if (transition === "applied") {
    next[STATE_VARIABLES.lastHandled] = migrationId;
    next[STATE_VARIABLES.lastApplied] = migrationId;
  } else if (transition === "declined") {
    next[STATE_VARIABLES.lastHandled] = migrationId;
    next[STATE_VARIABLES.lastDeclined] = migrationId;
  } else {
    throw new Error(`Unknown state transition: ${transition}`);
  }
  return next;
}

export async function readRepoVariables(api, repoFullName) {
  const repo = parseRepo(repoFullName);
  const state = blankSubscriberState();
  for (const name of Object.values(STATE_VARIABLES)) {
    try {
      const variable = await api.request("GET", `/repos/${repo.owner}/${repo.repo}/actions/variables/${name}`);
      state[name] = variable.value || "";
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
    }
  }
  return state;
}

export async function writeRepoVariable(api, repoFullName, name, value) {
  const repo = parseRepo(repoFullName);
  try {
    await api.request("PATCH", `/repos/${repo.owner}/${repo.repo}/actions/variables/${name}`, {
      body: { name, value: String(value || "") }
    });
  } catch (error) {
    if (error.status !== 404) {
      throw error;
    }
    await api.request("POST", `/repos/${repo.owner}/${repo.repo}/actions/variables`, {
      body: { name, value: String(value || "") }
    });
  }
}

export async function writeSubscriberStateTransition(api, repoFullName, transition, migrationId) {
  const updates = applyStateTransition(blankSubscriberState(), transition, migrationId);
  const names =
    transition === "opened"
      ? [STATE_VARIABLES.lastHandled]
      : transition === "applied"
        ? [STATE_VARIABLES.lastHandled, STATE_VARIABLES.lastApplied]
        : [STATE_VARIABLES.lastHandled, STATE_VARIABLES.lastDeclined];
  for (const name of names) {
    await writeRepoVariable(api, repoFullName, name, updates[name]);
  }
}
