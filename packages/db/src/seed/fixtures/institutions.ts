/**
 * docs/CONTEXT.md section 3: "Launch market: NTU Singapore, then NUS / SMU / other SG
 * universities, then global." ROR IDs verified against the live ROR API
 * (https://api.ror.org/v2/organizations) on 2026-09-25, not guessed.
 */
export interface InstitutionFixture {
  rorId: string;
  name: string;
  country: string;
  emailDomains: string[];
}

export const institutionFixtures: InstitutionFixture[] = [
  {
    rorId: "02e7b5302",
    name: "Nanyang Technological University",
    country: "SG",
    // ntu.edu.sg is staff/faculty; e.ntu.edu.sg is the student domain — both real, both named
    // explicitly in docs/CONTEXT.md section 5.
    emailDomains: ["ntu.edu.sg", "e.ntu.edu.sg"],
  },
  {
    rorId: "01tgyzw49",
    name: "National University of Singapore",
    country: "SG",
    emailDomains: ["nus.edu.sg", "u.nus.edu"],
  },
  {
    rorId: "050qmg959",
    name: "Singapore Management University",
    country: "SG",
    emailDomains: ["smu.edu.sg"],
  },
  {
    rorId: "05j6fvn87",
    name: "Singapore University of Technology and Design",
    country: "SG",
    emailDomains: ["sutd.edu.sg"],
  },
];
