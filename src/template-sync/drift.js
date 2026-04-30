import fs from "node:fs";
import path from "node:path";

export function scoreDrift({ root, bundle }) {
  const warnings = [];
  for (const file of bundle.changedFiles || []) {
    const target = path.join(root, file.filename);
    const existedInTemplate = file.status !== "added";
    if (existedInTemplate && !fs.existsSync(target)) {
      warnings.push(`Affected file \`${file.filename}\` does not exist in this subscriber repo.`);
    }
    if (file.previousFilename && !fs.existsSync(path.join(root, file.previousFilename))) {
      warnings.push(`Renamed source file \`${file.previousFilename}\` does not exist in this subscriber repo.`);
    }
  }
  return {
    level: warnings.length >= 3 ? "high" : warnings.length > 0 ? "medium" : "low",
    warnings
  };
}
