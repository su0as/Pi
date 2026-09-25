/**
 * Fictional demo users, spread across institutions and departments so the diversity-key rule in
 * docs/CONTEXT.md section 7.5 (scorer v0 needs raters from >= 2 distinct
 * (institution, department) pairs) has something real to exercise locally. Department/school
 * names are the real ones at each institution; the people are not.
 */
export interface DemoUserFixture {
  handle: string;
  displayName: string;
  affiliation: {
    institutionRorId: string;
    department: string;
    position:
      | "undergrad"
      | "masters"
      | "phd"
      | "postdoc"
      | "faculty"
      | "staff"
      | "industry"
      | "other";
  };
}

export const demoUserFixtures: DemoUserFixture[] = [
  {
    handle: "alice_chen",
    displayName: "Alice Chen",
    affiliation: {
      institutionRorId: "02e7b5302", // NTU
      department: "School of Computer Science and Engineering",
      position: "phd",
    },
  },
  {
    handle: "brandon_lim",
    displayName: "Brandon Lim",
    affiliation: {
      institutionRorId: "02e7b5302", // NTU
      department: "School of Electrical and Electronic Engineering",
      position: "phd",
    },
  },
  {
    handle: "cheryl_tan",
    displayName: "Cheryl Tan",
    affiliation: {
      institutionRorId: "01tgyzw49", // NUS
      department: "School of Computing",
      position: "masters",
    },
  },
  {
    handle: "dinesh_kumar",
    displayName: "Dinesh Kumar",
    affiliation: {
      institutionRorId: "02e7b5302", // NTU
      department: "School of Computer Science and Engineering",
      position: "postdoc",
    },
  },
  {
    handle: "elena_wong",
    displayName: "Elena Wong",
    affiliation: {
      institutionRorId: "050qmg959", // SMU
      department: "School of Computing and Information Systems",
      position: "undergrad",
    },
  },
  {
    handle: "farid_azman",
    displayName: "Farid Azman",
    affiliation: {
      institutionRorId: "02e7b5302", // NTU
      department: "School of Computer Science and Engineering",
      position: "faculty",
    },
  },
];
