// Action verbs: Match both base forms and common variations
// Includes gerunds (developing, managing) and past tense
export const universalActionVerbs = [
  // Management & Leadership
  /\b(manage|managing|managed|manager)\b/i, /\b(lead|leading|led)\b/i, /\b(direct|directing)\b/i, /\b(oversee|overseeing)\b/i,
  /\b(supervise|supervising|supervised)\b/i, /\b(coordinate|coordinating)\b/i, /\b(delegate|delegating)\b/i,
  
  // Support & Assistance
  /\b(support|supporting|supported)\b/i, /\b(assist|assisting)\b/i, /\b(help|helping)\b/i, /\b(guide|guiding)\b/i,
  /\b(mentor|mentoring)\b/i, /\b(train|training|trained)\b/i, /\b(coach|coaching)\b/i,
  
  // Planning & Organization
  /\b(plan|planning|planned)\b/i, /\b(organize|organizing|organized)\b/i, /\b(schedule|scheduling)\b/i,
  /\b(prepare|preparing|prepared)\b/i, /\b(prioritize|prioritizing)\b/i, /\b(strategize|strategizing)\b/i,
  /\b(define|defining|defined)\b/i,
  
  // Execution & Delivery
  /\b(deliver|delivering|delivered)\b/i, /\b(execute|executing|executed)\b/i, /\b(implement|implementing|implemented)\b/i,
  /\b(perform|performing|performed)\b/i, /\b(complete|completing|completed)\b/i, /\b(achieve|achieving|achieved)\b/i,
  /\b(accomplish|accomplishing)\b/i, /\b(ship|shipping|shipped)\b/i, /\b(participate|participating|participated)\b/i,
  
  // Development & Creation
  /\b(develop|developing|developed)\b/i, /\b(create|creating|created)\b/i, /\b(build|building|built)\b/i,
  /\b(design|designing|designed)\b/i, /\b(architect|architecting)\b/i, /\b(engineer|engineering)\b/i,
  /\b(craft|crafting|crafted)\b/i, /\b(construct|constructing)\b/i, /\b(produce|producing)\b/i,
  
  // Analysis & Evaluation
  /\b(analyze|analyzing|analyzed)\b/i, /\b(evaluate|evaluating|evaluated)\b/i, /\b(assess|assessing)\b/i,
  /\b(review|reviewing|reviewed)\b/i, /\b(examine|examining)\b/i, /\b(investigate|investigating)\b/i,
  /\b(research|researching)\b/i, /\b(test|testing|tested)\b/i, /\b(audit|auditing)\b/i,
  
  // Maintenance & Operations
  /\b(maintain|maintaining|maintained)\b/i, /\b(operate|operating|operated)\b/i, /\b(monitor|monitoring|monitored)\b/i,
  /\b(track|tracking|tracked)\b/i, /\b(update|updating|updated)\b/i, /\b(optimize|optimizing)\b/i,
  /\b(collect|collecting|collected)\b/i,
  
  // Communication & Collaboration
  /\b(communicate|communicating)\b/i, /\b(collaborate|collaborating)\b/i, /\b(facilitate|facilitating)\b/i,
  /\b(present|presenting|presented)\b/i, /\b(report|reporting|reported)\b/i, /\b(document|documenting)\b/i,
  /\b(consult|consulting)\b/i, /\b(advise|advising)\b/i, /\b(negotiate|negotiating)\b/i,
  /\b(represent|representing|represented)\b/i, /\b(profile|profiling)\b/i, /\b(contribute|contributing|contributed)\b/i,
  
  // Improvement & Innovation
  /\b(improve|improving|improved)\b/i, /\b(enhance|enhancing|enhanced)\b/i, /\b(innovate|innovating)\b/i,
  /\b(transform|transforming)\b/i, /\b(streamline|streamlining)\b/i, /\b(refactor|refactoring)\b/i,
  /\b(customize|customizing|customized)\b/i,
  
  // Ownership & Responsibility
  /\b(own|owning|ownership)\b/i, /\b(drive|driving)\b/i, /\b(ensure|ensuring|ensured)\b/i,
  /\b(guarantee|guaranteeing)\b/i, /\b(handle|handling|handled)\b/i, /\b(provide|providing|provided)\b/i,
  /\b(decision)\b/i, /\bdecisions\b/i, /take on/i,
  
  // Extension & Growth
  /\b(extend|extending|extended)\b/i, /\b(expand|expanding|expanded)\b/i, /\b(scale|scaling|scaled)\b/i,
  /\b(grow|growing)\b/i, /\b(increase|increasing)\b/i, /\b(deploy|deploying|deployed)\b/i,
  /\b(growth)\b/i, /\b(approach)\b/i, /\b(success)\b/i,
];

// Responsibility expressions: Multi-word phrases, no word boundaries needed
export const responsibilityExpressions = [
  // Direct responsibility phrases
  /responsible for/i, /responsibilities include/i, /key responsibilities/i, /primary responsibilities/i,
  /main responsibilities/i, /core responsibilities/i, /be responsible/i, /take responsibility/i,
  
  // Role descriptions
  /in this role/i, /your role/i, /the role/i, /this position/i, /role includes/i, /role involves/i,
  /as a .{1,30} you will/i, /position requires/i, /position involves/i, /you are part/i,
  
  // Task descriptions
  /duties include/i, /main duties/i, /daily tasks/i, /day-to-day/i, /on a daily basis/i,
  
  // Action-oriented phrases
  /you will/i, /you'll/i, /you would/i, /you'll be/i, /you will be/i,
  /what you'll do/i, /what you will do/i, /your tasks/i, /your duties/i,
  
  // Collaboration phrases
  /work (closely )?with/i, /work on/i, /work alongside/i, /partner with/i, /collaborate with/i,
  /interface with/i, /engage with/i, /coordinate with/i,
  
  // Ownership phrases
  /take ownership/i, /own the/i, /drive the/i, /lead the/i, /manage the/i,
  /oversee the/i, /be accountable for/i, /accountable for/i,
];

// Requirement terminology: Allow variations (requirement/requirements, qualify/qualification/qualifications)
export const requirementTerminology = [
  // Core requirement terms
  /requirement/i, /qualification/i, /prerequisite/i, /criteria/i,
  
  // Skills & abilities
  /\bskills/i, /ability to/i, /capable of/i, /proficien/i, /competen/i, /expertise in/i,
  
  // Experience terms
  /\bexperience\b/i, /\d+\+? years/i, /years of experience/i, /proven track record/i,
  /demonstrated experience/i, /hands-on experience/i, /practical experience/i, /\blevel\b/i,
  
  // Knowledge terms
  /knowledge/i, /understanding of/i, /familiar with/i, /familiarity with/i,
  /background in/i, /exposure to/i, /working knowledge/i, /deep understanding/i,
  
  // Necessity levels
  /must have/i, /should have/i, /required/i, /mandatory/i, /essential/i,
  /critical/i, /necessary/i, /needed/i, /expected to have/i,
  
  // Preference levels
  /nice to have/i, /preferred/i, /desirable/i, /bonus/i, /plus/i,
  /ideal candidate/i, /strong candidate/i, /would be great/i,
  
  // Education & certification
  /degree in/i, /bachelor/i, /master/i, /phd/i, /certification/i, /certified/i,
  /diploma/i, /graduate/i, /education/i,
];

// Candidate phrases: Multi-word phrases, no word boundaries needed
export const candidatePhrases = [
  // Ideal candidate descriptions
  /the ideal candidate/i, /ideal candidate/i, /successful candidate/i, /right candidate/i,
  /perfect candidate/i, /ideal applicant/i, /strong candidate/i,
  
  // Seeking phrases
  /we are looking for/i, /we're looking for/i, /looking for someone/i, /seeking a/i,
  /we seek/i, /in search of/i, /we need/i, /we want/i, /\bopportunities\b/i,
  /\bvacancy\b/i, /\boffer\b/i, /\bjoin\b/i,
  
  // Expectation phrases
  /we expect/i, /you should have/i, /you must have/i, /you will have/i,
  /applicants should/i, /candidates should/i, /candidates must/i,
  
  // Fit descriptions
  /you are a good fit/i, /you'll be a great fit/i, /right fit/i,
  /you're the one/i, /you might be perfect/i, /\bmatch\b/i,
];

// Skill terminology: Allow variations (skill/skills, ability/abilities)
export const skillTerminology = [
  /\bskill/i, /abilit/i, /competenc/i, /proficien/i, /expertise/i,
  /knowledge/i, /experience/i, /qualification/i, /capabilit/i,
];

// Environment terms: Mix of single words (use \b) and variations (no \b)
export const environmentTerms = [
  /\bteam/i, /collaborat/i, /environment/i, /stakeholder/i, /\bclient/i,
  /customer/i, /partner/i, /cross[- ]functional/i, /department/i, /manager/i,
  /leadership/i, /communicat/i, /fast-paced/i, /workload/i, /\bculture\b/i,
  /\bworkflow\b/i, /\bprocess\b/i, /\bstrategy\b/i, /\bservice\b/i, /\bmarket\b/i,
  /\bmeetings\b/i, /\bbusiness\b/i, /\bimpact\b/i, /\bdirectly\b/i,
];

// Soft skills: Allow variations (communicate/communication/communicating)
export const universalSoftSkills = [
  // Communication skills
  /communicat/i, /interpersonal skill/i, /verbal/i, /written/i, /presentation skill/i,
  /articulate/i, /clear communicator/i, /effective communicat/i,
  
  // Collaboration & teamwork
  /teamwork/i, /team player/i, /collaborat/i, /work well with others/i, /cross-functional/i,
  /partnership/i, /cooperative/i, /\bcolleague\b/i, /all-round/i,
  
  // Adaptability & flexibility
  /adaptab/i, /flexible/i, /agile/i, /dynamic/i, /fast-paced/i, /quick learner/i,
  /embrace change/i, /thrive in/i, /\bthrives\b/i,
  
  // Problem-solving & critical thinking
  /problem solving/i, /critical thinking/i, /analytical/i, /troubleshoot/i,
  /creative thinking/i, /innovative/i, /solution-oriented/i,
  
  // Organization & time management
  /organizational skill/i, /time management/i, /prioritiz/i, /multitask/i,
  /detail-oriented/i, /attention to detail/i, /organized/i, /efficient/i,
  /\bquality\b/i, /\befficiency\b/i, /high pace/i, /\bdetail\b/i, /\bability\b/i,
  
  // Initiative & motivation
  /initiative/i, /self-motivated/i, /proactive/i, /self-starter/i, /driven/i,
  /motivated/i, /ambitious/i, /ambition/i, /passionate/i, /enthusiastic/i,
  
  // Learning & growth
  /willingness to learn/i, /eager to learn/i, /continuous learning/i, /growth mindset/i,
  /curiosity/i, /curious/i, /open to feedback/i, /feedback/i, /\blearn\b/i, /\bchallenge\b/i,
  
  // Leadership & ownership
  /leadership/i, /ownership/i, /accountability/i, /responsible/i, /reliable/i,
  /dependable/i, /trustworthy/i,
  
  // Work ethic
  /work ethic/i, /dedicated/i, /committed/i, /professional/i, /integrity/i,
  /sense of humor/i, /positive attitude/i, /\bvalues\b/i,
];

// Obligation words: Use word boundaries for exact matches
export const obligationWords = [
  /\bmust\b/i, /\bshould\b/i, /\brequired\b/i, /expected to/i, /\bneed to\b/i, /responsible for/i,
];

// Operational verbs: Match with context to avoid false positives
export const operationalVerbs = [
  /\blift\b/i, /\bclean\b/i, /\bassemble\b/i, /\binspect\b/i, /\bpack\b/i,
  /\bload\b/i, /\bcarrying\b/i, /\bmanual\b/i,
];

export const structurePatterns = [
  // Section headers (with colons)
  /responsibilities:/i, /requirements:/i, /qualifications:/i, /skills:/i,
  /tasks:/i, /duties:/i, /experience:/i, /education:/i,
  
  // Key JD words (without colons) - use word boundaries to avoid false positives
  /\bresponsibilities\b/i, /\brequirements\b/i, /\bqualifications\b/i, /\bskills\b/i,
  /\btasks\b/i, /\bduties\b/i, /\bexperience\b/i, /\beducation\b/i,
  /\bjob\b/i, /\brole\b/i, /\bposition\b/i, /\bcandidate\b/i, /\bapplicant\b/i, /\bspecialist\b/i,
  /\bwork\b/i, /\bapply\b/i, /\bapplication\b/i, /\bhiring\b/i, /\bemployment\b/i,
  /\bsalary\b/i, /\bpaid\b/i, /\bbenefits\b/i, /\bcompensation\b/i, /\bpackage\b/i, /\bwage\b/i,
  /\bholiday\b/i, /\ballowance\b/i, /\bcompetitive\b/i, /\bhours\b/i,
  /\bremote\b/i, /on[- ]site/i, /\boffice\b/i, /\bhybrid\b/i, /\blocation\b/i,
  /\bfull[- ]time\b/i, /\bpart[- ]time\b/i, /\bcontract\b/i, /\bfreelance\b/i,
  /\bcompany\b/i, /\bclient\b/i, /\bemployer\b/i, /\borganization\b/i, /\bbusiness\b/i,
  
  // Common JD section titles
  /what you'll do/i, /what you will do/i, /your responsibilities/i,
  /who you are/i, /about you/i, /about the role/i, /the role/i,
  /what we're looking for/i, /what we are looking for/i, /we're looking for/i,
  /what you'll bring/i, /what you bring/i, /you'll bring/i,
  /key responsibilities/i, /main responsibilities/i, /core responsibilities/i,
  /required qualifications/i, /preferred qualifications/i,
  /minimum qualifications/i, /basic qualifications/i,
  /nice to have/i, /bonus points/i, /plus if you have/i,
  
  // Job posting structure indicators
  /position overview/i, /role overview/i, /job description/i, /job summary/i,
  /about this position/i, /about this role/i, /about this opportunity/i,
  /what you'll need/i, /what we need/i, /what we expect/i,
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
  ...structurePatterns,
];
