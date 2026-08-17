/** Multi-select ปัญหา helpers shared by Complaint / Reject forms. */

export function normalizeProblemNames(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) {
    const out = [];
    const seen = new Set();
    for (const item of value) {
      for (const name of normalizeProblemNames(item)) {
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(name);
      }
    }
    return out;
  }
  const raw = String(value).trim();
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      return normalizeProblemNames(JSON.parse(raw));
    } catch {
      /* fall through */
    }
  }
  if (raw.includes(" · ")) {
    return normalizeProblemNames(raw.split(" · "));
  }
  return [raw];
}

export function problemNamesOf(record) {
  const fromNames = normalizeProblemNames(record?.problem_names);
  if (fromNames.length) return fromNames;
  if (Array.isArray(record?.problems) && record.problems.length) {
    return normalizeProblemNames(record.problems.map((row) => row?.name));
  }
  const fromJson = normalizeProblemNames(record?.problem_names_json);
  if (fromJson.length) return fromJson;
  return normalizeProblemNames(record?.problem_name);
}

export function problemSaveFields(value) {
  const names = normalizeProblemNames(value);
  return {
    problem_names: names,
    problem_names_json: JSON.stringify(names),
    problem_name: names.join(" · "),
  };
}

export function mergeRelatedRejects(rows) {
  const list = (rows || []).filter(Boolean);
  if (!list.length) return null;
  const problems = [];
  const seen = new Set();
  for (const row of list) {
    const items = Array.isArray(row.problems) && row.problems.length
      ? row.problems
      : problemNamesOf(row).map((name) => ({ id: null, name, name_en: null }));
    for (const item of items) {
      const name = String(item?.name || "").trim();
      if (!name) continue;
      const key = item.id ? `id:${item.id}` : `name:${name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      problems.push({
        id: item.id || null,
        name,
        name_en: item.name_en || null,
      });
    }
  }
  const names = problems.map((row) => row.name);
  return {
    ...list[0],
    problems,
    problem_names: names,
    problem_name: names.join(" · ") || list[0].problem_name || null,
  };
}

export function formatProblemLabel(record) {
  return problemNamesOf(record).join(" · ");
}

export function formatProblemNameEn(record) {
  const ens = (record?.problems || [])
    .map((row) => String(row?.name_en || "").trim())
    .filter(Boolean);
  if (ens.length) return ens.join(" · ");
  return String(record?.problem_name_en || "").trim();
}

export function appendProblemNames(formData, value) {
  const fields = problemSaveFields(value);
  formData.append("problem_names", fields.problem_names_json);
  formData.append("problem_names_json", fields.problem_names_json);
  formData.append("problem_name", fields.problem_name);
  return fields.problem_names;
}

export function hasProblemOverlap(complaint, reject) {
  if (!complaint || !reject) return false;
  const aIds = new Set(
    (complaint.problems || [])
      .map((row) => Number(row?.id))
      .filter((id) => Number.isInteger(id) && id > 0),
  );
  const bIds = (reject.problems || [])
    .map((row) => Number(row?.id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (aIds.size && bIds.length) {
    return bIds.some((id) => aIds.has(id));
  }
  const aNames = new Set(problemNamesOf(complaint).map((name) => name.toLowerCase()));
  return problemNamesOf(reject).some((name) => aNames.has(name.toLowerCase()));
}

export function ensureProblemOptions(options, names) {
  const list = options || [];
  const extra = [];
  for (const name of names || []) {
    if (!name) continue;
    if (list.some((item) => item.value === name) || extra.some((item) => item.value === name)) {
      continue;
    }
    extra.push({ value: name, label: name });
  }
  return extra.length ? [...extra, ...list] : list;
}
