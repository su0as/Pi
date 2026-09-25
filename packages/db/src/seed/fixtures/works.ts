/**
 * Recorded arXiv fixtures — CLAUDE.md/M1 requires "no live network in seed or tests," so this
 * file is the recording. Every field below was fetched from the real arXiv API
 * (export.arxiv.org/api/query) on 2026-09-25 and copied here, not written from memory or
 * guessed — see docs/adr/0005-seed-fixture-provenance.md for how and why.
 *
 * `license` is deliberately `null` for every entry: the arXiv API responses this was built from
 * didn't include license metadata, and CLAUDE.md says never guess a figure — so
 * `canDisplayFullText` stays `false` for all seed works rather than assume a license that lets
 * full text display. A real ingestion (M4) fetches and records the actual license per version.
 */
export interface WorkFixture {
  arxivId: string;
  title: string;
  abstract: string;
  publishedAt: string; // ISO 8601 date
  authors: string[];
  /** arXiv category codes; first is the primary category. */
  topics: string[];
}

export const workFixtures: WorkFixture[] = [
  {
    arxivId: "1512.03385",
    title: "Deep Residual Learning for Image Recognition",
    abstract:
      "Proposes a residual learning framework that makes substantially deeper networks easier to train, reformulating layers to learn residual functions relative to their inputs. A 152-layer ResNet reaches 3.57% error on ImageNet, winning first place in the ILSVRC 2015 classification task.",
    publishedAt: "2015-12-10",
    authors: ["Kaiming He", "Xiangyu Zhang", "Shaoqing Ren", "Jian Sun"],
    topics: ["cs.CV"],
  },
  {
    arxivId: "1706.03762",
    title: "Attention Is All You Need",
    abstract:
      "Introduces the Transformer, a sequence transduction architecture built entirely on attention mechanisms, dispensing with recurrence and convolutions. Reaches 28.4 BLEU on WMT 2014 English-to-German translation and generalizes well to other tasks.",
    publishedAt: "2017-06-12",
    authors: [
      "Ashish Vaswani",
      "Noam Shazeer",
      "Niki Parmar",
      "Jakob Uszkoreit",
      "Llion Jones",
      "Aidan N. Gomez",
      "Lukasz Kaiser",
      "Illia Polosukhin",
    ],
    topics: ["cs.CL", "cs.LG"],
  },
  {
    arxivId: "2005.14165",
    title: "Language Models are Few-Shot Learners",
    abstract:
      "Shows that scaling up language models greatly improves task-agnostic, few-shot performance. GPT-3, with 175 billion parameters, performs competitively on translation, question-answering, and reasoning tasks using only a handful of in-context examples, without gradient updates.",
    publishedAt: "2020-05-28",
    authors: [
      "Tom B. Brown",
      "Benjamin Mann",
      "Nick Ryder",
      "Melanie Subbiah",
      "Jared Kaplan",
      "Prafulla Dhariwal",
      "Arvind Neelakantan",
      "Pranav Shyam",
      "Girish Sastry",
      "Amanda Askell",
      "Sandhini Agarwal",
      "Ariel Herbert-Voss",
      "Gretchen Krueger",
      "Tom Henighan",
      "Rewon Child",
      "Aditya Ramesh",
      "Daniel M. Ziegler",
      "Jeffrey Wu",
      "Clemens Winter",
      "Christopher Hesse",
      "Mark Chen",
      "Eric Sigler",
      "Mateusz Litwin",
      "Scott Gray",
      "Benjamin Chess",
      "Jack Clark",
      "Christopher Berner",
      "Sam McCandlish",
      "Alec Radford",
      "Ilya Sutskever",
      "Dario Amodei",
    ],
    topics: ["cs.CL"],
  },
  {
    arxivId: "1810.04805",
    title: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
    abstract:
      "Introduces BERT, pre-trained using masked language modeling to build deep bidirectional representations from unlabeled text. A single additional output layer suffices to fine-tune it for a wide range of tasks, reaching state-of-the-art results on eleven NLP benchmarks.",
    publishedAt: "2018-10-11",
    authors: ["Jacob Devlin", "Ming-Wei Chang", "Kenton Lee", "Kristina Toutanova"],
    topics: ["cs.CL"],
  },
  {
    arxivId: "1312.6114",
    title: "Auto-Encoding Variational Bayes",
    abstract:
      "Proposes a stochastic variational inference and learning algorithm for directed probabilistic models with continuous latent variables, using a reparameterization of the variational lower bound that yields an estimator optimizable with standard stochastic gradient methods.",
    publishedAt: "2013-12-20",
    authors: ["Diederik P. Kingma", "Max Welling"],
    topics: ["stat.ML"],
  },
  {
    arxivId: "1409.1556",
    title: "Very Deep Convolutional Networks for Large-Scale Image Recognition",
    abstract:
      "Investigates the effect of convolutional network depth on accuracy using very small (3x3) convolution filters, pushing depth to 16-19 weight layers. This configuration (VGG) placed first and second in the localization and classification tracks of ImageNet Challenge 2014.",
    publishedAt: "2014-09-04",
    authors: ["Karen Simonyan", "Andrew Zisserman"],
    topics: ["cs.CV"],
  },
  {
    arxivId: "1502.03167",
    title:
      "Batch Normalization: Accelerating Deep Network Training by Reducing Internal Covariate Shift",
    abstract:
      "Addresses internal covariate shift by normalizing layer inputs per mini-batch, allowing much higher learning rates and reducing the need for careful initialization. Applied to an ImageNet classifier, it matches prior accuracy with 14 times fewer training steps and improves top result to 4.8% top-5 test error.",
    publishedAt: "2015-02-11",
    authors: ["Sergey Ioffe", "Christian Szegedy"],
    topics: ["cs.LG"],
  },
  {
    arxivId: "1406.2661",
    title: "Generative Adversarial Networks",
    abstract:
      "Proposes an adversarial framework in which a generative model and a discriminative model are trained simultaneously in a minimax game, with the generator learning to produce samples indistinguishable from real data by the discriminator.",
    publishedAt: "2014-06-10",
    authors: [
      "Ian J. Goodfellow",
      "Jean Pouget-Abadie",
      "Mehdi Mirza",
      "Bing Xu",
      "David Warde-Farley",
      "Sherjil Ozair",
      "Aaron Courville",
      "Yoshua Bengio",
    ],
    topics: ["stat.ML", "cs.LG"],
  },
  {
    arxivId: "1301.3781",
    title: "Efficient Estimation of Word Representations in Vector Space",
    abstract:
      "Introduces two efficient model architectures for computing continuous vector representations of words from very large datasets, evaluated on a word similarity task and shown to improve accuracy substantially at lower computational cost than prior neural-network approaches.",
    publishedAt: "2013-01-16",
    authors: ["Tomas Mikolov", "Kai Chen", "Greg Corrado", "Jeffrey Dean"],
    topics: ["cs.CL"],
  },
  {
    arxivId: "2010.11929",
    title: "An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale",
    abstract:
      "Shows that a pure Transformer applied directly to sequences of image patches performs well on image classification, attaining excellent results compared to convolutional networks while requiring substantially fewer computational resources to train.",
    publishedAt: "2020-10-22",
    authors: [
      "Alexey Dosovitskiy",
      "Lucas Beyer",
      "Alexander Kolesnikov",
      "Dirk Weissenborn",
      "Xiaohua Zhai",
      "Thomas Unterthiner",
      "Mostafa Dehghani",
      "Matthias Minderer",
      "Georg Heigold",
      "Sylvain Gelly",
      "Jakob Uszkoreit",
      "Neil Houlsby",
    ],
    topics: ["cs.CV", "cs.AI", "cs.LG"],
  },
  {
    arxivId: "1804.02767",
    title: "YOLOv3: An Incremental Improvement",
    abstract:
      "Presents a series of small design updates to the YOLO object detector along with a new, larger backbone network, trading off some speed for improved accuracy over prior YOLO versions.",
    publishedAt: "2018-04-08",
    authors: ["Joseph Redmon", "Ali Farhadi"],
    topics: ["cs.CV"],
  },
  {
    arxivId: "2003.08934",
    title: "NeRF: Representing Scenes as Neural Radiance Fields for View Synthesis",
    abstract:
      "Synthesizes novel views of complex scenes by optimizing a continuous volumetric scene function, represented by a fully-connected network, from a sparse set of input views, achieving results that outperform prior work on neural rendering and view synthesis.",
    publishedAt: "2020-03-19",
    authors: [
      "Ben Mildenhall",
      "Pratul P. Srinivasan",
      "Matthew Tancik",
      "Jonathan T. Barron",
      "Ravi Ramamoorthi",
      "Ren Ng",
    ],
    topics: ["cs.CV"],
  },
  {
    arxivId: "1707.06347",
    title: "Proximal Policy Optimization Algorithms",
    abstract:
      "Proposes a family of policy gradient methods that alternate between sampling data through environment interaction and optimizing a surrogate objective using stochastic gradient ascent, simpler to implement and tune than trust region methods while retaining their stability.",
    publishedAt: "2017-07-20",
    authors: ["John Schulman", "Filip Wolski", "Prafulla Dhariwal", "Alec Radford", "Oleg Klimov"],
    topics: ["cs.LG"],
  },
  {
    arxivId: "1509.02971",
    title: "Continuous control with deep reinforcement learning",
    abstract:
      "Adapts the ideas behind Deep Q-Learning's success to the continuous action domain, presenting a model-free, off-policy actor-critic algorithm that learns policies directly from raw pixel inputs across a range of continuous control tasks.",
    publishedAt: "2015-09-09",
    authors: [
      "Timothy P. Lillicrap",
      "Jonathan J. Hunt",
      "Alexander Pritzel",
      "Nicolas Heess",
      "Tom Erez",
      "Yuval Tassa",
      "David Silver",
      "Daan Wierstra",
    ],
    topics: ["cs.LG", "stat.ML"],
  },
  {
    arxivId: "1802.09477",
    title: "Addressing Function Approximation Error in Actor-Critic Methods",
    abstract:
      "Shows that function approximation error in value-based reinforcement learning leads to value overestimation, and proposes a twin-critic, delayed-update actor-critic algorithm (TD3) that reduces overestimation and improves performance on continuous control benchmarks.",
    publishedAt: "2018-02-26",
    authors: ["Scott Fujimoto", "Herke van Hoof", "David Meger"],
    topics: ["cs.AI", "cs.LG", "stat.ML"],
  },
  {
    arxivId: "2609.30249",
    title: "RAPID: Robot Agentic Programming from Demonstrations",
    abstract:
      "Presents a framework that automatically generates and refines robot programs from a single visual demonstration, using object-centric relational representations to produce reusable programs that generalize across object variation and environments, deployed on simulated benchmarks and physical robot arms.",
    publishedAt: "2026-09-24",
    authors: [
      "Yuyao Liu",
      "Jiayuan Mao",
      "David Hsu",
      "Leslie Pack Kaelbling",
      "Tomás Lozano-Pérez",
    ],
    topics: ["cs.RO", "cs.AI", "cs.CV"],
  },
  {
    arxivId: "2609.30076",
    title:
      "Beyond Driving: Envisioning Activities in Future Autonomous Vehicles through Experience-Centered Design",
    abstract:
      "Uses experience-centered design methods — diary studies, scenario scripting, and mixed-reality enactments — to investigate how occupants might spend their time in fully autonomous vehicles, arguing that non-driving-related activities should be understood as dynamic sequences shaped by pre- and post-journey context, not isolated time-use instances.",
    publishedAt: "2026-09-24",
    authors: [
      "Keqi Chen",
      "Xiao Xue",
      "Xinyi Liu",
      "Runjia Tan",
      "Chris Speed",
      "Lee Kwan Min",
      "Chen Lv",
    ],
    topics: ["cs.HC"],
  },
  {
    arxivId: "2609.30219",
    title:
      "Requirement-Bound Verified Commissioning: A Frozen Four-Billion-Parameter Local Model as a Candidate Generator under an External Acceptance Layer with Verification and Release Authority",
    abstract:
      "Describes an acceptance protocol for sensor-coordinate and polarity binding in mechatronic commissioning that separates candidate generation (a frozen local language model) from release authority (a deterministic external verifier), evaluated on 144 commissioning tasks.",
    publishedAt: "2026-09-24",
    authors: ["Mehmet Iscan"],
    topics: ["cs.SE", "cs.AI", "eess.SY"],
  },
  {
    arxivId: "2609.30176",
    title: "Track-conditioned Residual Frequency Estimation For Low-resolution FMCW Radar",
    abstract:
      "Proposes a track-conditioned frequency estimation approach for low-resolution FMCW radar that removes predicted target phase before spectral analysis and condenses each chirp into coherent complex sums, reducing representation size substantially while improving range and velocity error over conventional zero-padded FFT methods.",
    publishedAt: "2026-09-24",
    authors: ["Huy Trinh", "George Shaker"],
    topics: ["eess.SP"],
  },
  {
    arxivId: "2609.30077",
    title:
      "Rate-distortion optimization for full-reference image quality metrics via stochastic Hessian estimates",
    abstract:
      "Approximates full-reference image quality metrics with an input-dependent quadratic distortion model derived from the Hessian of the metric at the source video, enabling video codec parameter selection via automatic differentiation with substantial bitrate savings and modest encoding overhead.",
    publishedAt: "2026-09-24",
    authors: ["Samuel Fernández-Menduiña", "Eduardo Pavez", "Antonio Ortega"],
    topics: ["eess.IV"],
  },
  {
    arxivId: "2609.29984",
    title:
      "A Spiking Neural Network Model of Elementary Self-Consciousness via Endogenous Default Mode Network Dynamics",
    abstract:
      "Presents a spiking neural network of sensory-processing and Default Mode Network subsystems investigating how endogenous pacemaker activity interacts with transient external sensory input to produce self-referential neural representations, with the DMN layer operating autonomously via brainstem-like neuromodulation.",
    publishedAt: "2026-09-24",
    authors: ["R. Lahoz-Beltra"],
    topics: ["q-bio.NC", "cs.NE"],
  },
];
