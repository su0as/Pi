/**
 * docs/CONTEXT.md section 9.2's seed categories: "cs.AI, cs.LG, cs.CV, cs.CL, cs.RO, cs.HC,
 * eess.SY, eess.SP, eess.IV, stat.ML, q-bio.*". Codes and names are arXiv's own published
 * taxonomy (arxiv.org/category_taxonomy), not invented.
 */
export interface TopicFixture {
  scheme: "arxiv";
  code: string;
  name: string;
  parentCode: string | null;
}

export const topicFixtures: TopicFixture[] = [
  // Top-level groups
  { scheme: "arxiv", code: "cs", name: "Computer Science", parentCode: null },
  {
    scheme: "arxiv",
    code: "eess",
    name: "Electrical Engineering and Systems Science",
    parentCode: null,
  },
  { scheme: "arxiv", code: "stat", name: "Statistics", parentCode: null },
  { scheme: "arxiv", code: "q-bio", name: "Quantitative Biology", parentCode: null },

  // cs.*
  { scheme: "arxiv", code: "cs.AI", name: "Artificial Intelligence", parentCode: "cs" },
  { scheme: "arxiv", code: "cs.LG", name: "Machine Learning", parentCode: "cs" },
  {
    scheme: "arxiv",
    code: "cs.CV",
    name: "Computer Vision and Pattern Recognition",
    parentCode: "cs",
  },
  { scheme: "arxiv", code: "cs.CL", name: "Computation and Language", parentCode: "cs" },
  { scheme: "arxiv", code: "cs.RO", name: "Robotics", parentCode: "cs" },
  { scheme: "arxiv", code: "cs.HC", name: "Human-Computer Interaction", parentCode: "cs" },

  // eess.*
  { scheme: "arxiv", code: "eess.SY", name: "Systems and Control", parentCode: "eess" },
  { scheme: "arxiv", code: "eess.SP", name: "Signal Processing", parentCode: "eess" },
  { scheme: "arxiv", code: "eess.IV", name: "Image and Video Processing", parentCode: "eess" },

  // stat.*
  { scheme: "arxiv", code: "stat.ML", name: "Machine Learning (Statistics)", parentCode: "stat" },

  // q-bio.* (a representative subset, not exhaustive — CONTEXT.md says "q-bio.*")
  { scheme: "arxiv", code: "q-bio.GN", name: "Genomics", parentCode: "q-bio" },
  { scheme: "arxiv", code: "q-bio.NC", name: "Neurons and Cognition", parentCode: "q-bio" },
  { scheme: "arxiv", code: "q-bio.QM", name: "Quantitative Methods", parentCode: "q-bio" },
];
