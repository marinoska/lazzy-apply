const universalActionVerbs = [
  "manage","lead","support","assist","maintain","coordinate","oversee","operate",
  "plan","prepare","monitor","improve","organize","deliver","conduct","perform",
  "ensure","implement","evaluate","develop","analyze","handle","provide",
  "communicate","facilitate","supervise","review","execute","achieve",
];

const responsibilityExpressions = [
  "responsible for", "responsibilities include", "in this role",
  "role includes", "role involves", "key responsibilities",
  "duties include", "main duties", "your role", "position requires",
  "daily tasks include",
];

const requirementTerminology = [
  "requirements", "qualifications", "skills", "experience", "knowledge",
  "ability to", "proficiency", "competency", "must have", "should have",
  "nice to have", "preferred", "mandatory", "essential",
];

const candidatePhrases = [
  "the ideal candidate", "successful candidate", "we are looking for",
  "we seek", "ideal applicant", "we expect", "applicants should",
];

const skillTerminology = [
  "skills", "abilities", "competencies", "proficiencies", "expertise",
  "knowledge", "experience", "qualifications", "capabilities",
];

const environmentTerms = [
  "team", "collaboration", "environment", "stakeholders", "clients",
  "customers", "partners", "cross-functional", "department", "manager",
  "leadership", "communication", "fast-paced", "workload",
];

const universalSoftSkills = [
  "communication", "teamwork", "adaptability", "attention to detail",
  "problem solving", "time management", "multitasking", "organizational skills",
  "interpersonal skills", "initiative",
];

const obligationWords = [
  "must", "should", "required", "expected to", "need to", "responsible for", 
];

const operationalVerbs = [
  "lift", "clean", "prepare", "assemble", "operate", "inspect", "pack",
  "deliver", "load", "organize", "serve", "assist", "maintain",
];

export const universalCluster = [
  ...universalActionVerbs,
  ...responsibilityExpressions,
  ...requirementTerminology,
  ...skillTerminology,
  ...candidatePhrases,
  ...environmentTerms,
  ...universalSoftSkills,
  ...obligationWords,
  ...operationalVerbs,
];
