import { buildScene, type SceneSeed } from '../sceneBuilder';

const seed: SceneSeed = {
  id: 'agent-learning',
  title: 'Reinforcement Learning for Evolving Agents',
  shortTitle: 'Evolving Agents',
  kicker: 'REINFORCEMENT LEARNING · MULTI-AGENT SYSTEMS',
  description: 'Learn how agents perceive, act, optimize rewards, cooperate, compete, and evolve—then connect each idea to a persistent San Francisco training world.',
  palette: 'violet',
  layout: 'clusters',
  shape: 'path',
  clusters: [
    {
      name: 'RL Foundations',
      subclusters: [
        {
          id: 'agent-environment-loop',
          label: 'The Agent–Environment Loop',
          description: 'Define the learning problem precisely: what an agent can observe, what it can do, how the world changes, and what success means over time.',
          concepts: [
            {
              title: 'Agent–Environment Interface',
              description: 'At each step, an agent receives an observation, selects an action, and receives the next observation and reward. A stable interface lets many bodies and algorithms use the same world.',
              tags: ['foundation', 'environment API', 'control loop'],
            },
            {
              title: 'Observations vs States',
              description: 'The true state contains everything needed to predict the future. An observation is the information exposed to the agent and may be partial, noisy, delayed, or body-specific.',
              tags: ['state', 'observation', 'partial observability'],
            },
            {
              title: 'Actions and Control Spaces',
              description: 'Actions may be discrete choices, continuous controls, or structured commands. Their frequency, bounds, and semantics determine what behaviors an agent can learn.',
              tags: ['actions', 'discrete control', 'continuous control'],
            },
            {
              title: 'Transitions and Markov Dynamics',
              description: 'A transition describes how state changes after an action. An MDP assumes the current state is sufficient; partial observability requires memory, belief, or recurrent policies.',
              tags: ['MDP', 'transition', 'POMDP'],
            },
            {
              title: 'Rewards, Returns, and Horizons',
              description: 'Reward is immediate feedback; return aggregates future rewards. Discount factors, episode boundaries, and time horizons control how strongly distant consequences matter.',
              tags: ['reward', 'return', 'discount factor', 'episode'],
            },
          ],
        },
        {
          id: 'policies-values-exploration',
          label: 'Policies, Values, and Exploration',
          description: 'Understand the mathematical objects that represent behavior, predict long-term outcomes, and guide learning under uncertainty.',
          concepts: [
            {
              title: 'Policy',
              description: 'A policy maps observations to action probabilities or continuous controls. It is the agent’s behavior rule and the main artifact produced by most RL training.',
              tags: ['policy', 'behavior', 'decision making'],
            },
            {
              title: 'State and Action Values',
              description: 'A value function estimates expected return from a state; an action-value function estimates return after choosing a particular action. Both turn long-term outcomes into learnable predictions.',
              tags: ['value function', 'Q-function', 'expected return'],
            },
            {
              title: 'Bellman Equations',
              description: 'Bellman equations express a value as immediate reward plus the value of what follows. This recursive structure is the basis of dynamic programming and temporal-difference learning.',
              tags: ['Bellman equation', 'bootstrapping', 'dynamic programming'],
            },
            {
              title: 'Exploration vs Exploitation',
              description: 'An agent must balance actions that currently seem best with actions that reveal better possibilities. Common tools include epsilon-greedy sampling, entropy bonuses, and intrinsic rewards.',
              tags: ['exploration', 'exploitation', 'entropy'],
            },
            {
              title: 'Temporal Credit Assignment',
              description: 'Credit assignment determines which earlier decisions caused a later outcome. Eligibility traces, advantages, and carefully designed signals help learning reach across long delays.',
              tags: ['credit assignment', 'advantage', 'delayed reward'],
            },
          ],
        },
      ],
    },
    {
      name: 'Learning Algorithms',
      subclusters: [
        {
          id: 'value-policy-algorithms',
          label: 'Value and Policy Algorithms',
          description: 'Compare the major algorithm families by what they learn, how they improve behavior, and which action spaces they support.',
          concepts: [
            {
              title: 'Tabular Q-Learning',
              description: 'Q-learning updates an action-value table toward reward plus the best estimated next value. It is off-policy and useful for understanding temporal-difference learning in small spaces.',
              tags: ['Q-learning', 'tabular RL', 'off-policy'],
            },
            {
              title: 'Deep Q-Networks',
              description: 'DQN replaces a value table with a neural network and stabilizes learning with replay data and a target network. It is designed primarily for discrete action spaces.',
              tags: ['DQN', 'deep RL', 'discrete actions'],
            },
            {
              title: 'Policy Gradients',
              description: 'Policy-gradient methods directly adjust policy parameters to increase expected return. They naturally support stochastic and continuous actions but can have high-variance updates.',
              tags: ['policy gradient', 'continuous control', 'optimization'],
            },
            {
              title: 'Actor–Critic Methods',
              description: 'An actor chooses actions while a critic estimates value and supplies a lower-variance learning signal. Most modern continuous-control systems use some form of this division.',
              tags: ['actor-critic', 'advantage', 'value learning'],
            },
            {
              title: 'Proximal Policy Optimization',
              description: 'PPO uses clipped policy updates to limit destructive changes between data collection and optimization. It is a strong baseline for simulated locomotion and general control tasks.',
              tags: ['PPO', 'on-policy', 'clipped objective'],
            },
          ],
        },
        {
          id: 'data-models-hierarchy',
          label: 'Training Data, Models, and Hierarchy',
          description: 'Learn how agents reuse experience, learn from demonstrations, predict the world, and organize long behaviors into reusable skills.',
          concepts: [
            {
              title: 'On-Policy vs Off-Policy Learning',
              description: 'On-policy methods learn from current behavior and usually discard stale rollouts. Off-policy methods can learn from older or different behavior, improving reuse but increasing correction and stability challenges.',
              tags: ['on-policy', 'off-policy', 'sample efficiency'],
            },
            {
              title: 'Replay Buffers and Target Networks',
              description: 'Replay buffers break temporal correlations and reuse transitions; target networks slow down moving learning targets. Sampling strategy and data age matter in non-stationary worlds.',
              tags: ['experience replay', 'target network', 'training data'],
            },
            {
              title: 'Imitation and Offline RL',
              description: 'Behavior cloning learns from demonstrations, while offline RL optimizes from a fixed dataset without new exploration. Human play traces can bootstrap difficult navigation and interaction skills.',
              tags: ['imitation learning', 'offline RL', 'demonstrations'],
            },
            {
              title: 'Model-Based RL and World Models',
              description: 'A learned or known dynamics model can predict outcomes, plan actions, or generate imagined experience. Models improve efficiency but can mislead policies where their predictions are inaccurate.',
              tags: ['model-based RL', 'world model', 'planning'],
            },
            {
              title: 'Hierarchical Reinforcement Learning',
              description: 'Hierarchical RL separates high-level goals from lower-level skills. Options and goal-conditioned policies can compose navigation, locomotion, interaction, and social behavior over long horizons.',
              tags: ['hierarchical RL', 'options', 'goal-conditioned policy'],
            },
          ],
        },
      ],
    },
    {
      name: 'Multi-Agent Learning',
      subclusters: [
        {
          id: 'coordination-competition',
          label: 'Coordination and Competition',
          description: 'Extend RL from one learner to many learners whose behavior changes the environment for everyone else.',
          concepts: [
            {
              title: 'Multi-Agent Markov Games',
              description: 'A Markov game gives every agent observations, actions, and rewards within shared dynamics. Joint actions determine transitions, so each agent becomes part of every other agent’s environment.',
              tags: ['MARL', 'Markov game', 'joint action'],
            },
            {
              title: 'Centralized Training, Decentralized Execution',
              description: 'Training can use global state or other agents’ information while deployed policies act from local observations. This reduces training ambiguity without requiring omniscience at runtime.',
              tags: ['CTDE', 'centralized critic', 'decentralized policy'],
            },
            {
              title: 'Self-Play and League Training',
              description: 'Agents improve by playing against current and historical policies. A diverse league reduces overfitting to one opponent and creates a moving curriculum of strategies.',
              tags: ['self-play', 'league training', 'opponent pool'],
            },
            {
              title: 'Cooperation, Competition, and Mixed Motives',
              description: 'Shared rewards encourage teamwork, individual rewards encourage competition, and mixed rewards create negotiation and social dilemmas. Reward structure defines the game agents learn to play.',
              tags: ['cooperation', 'competition', 'social dilemma'],
            },
            {
              title: 'Communication and Emergent Roles',
              description: 'Agents may communicate through explicit messages or observable actions. With the right pressure, populations can develop conventions, specialization, leadership, and complementary roles.',
              tags: ['communication', 'emergent roles', 'coordination'],
            },
          ],
        },
        {
          id: 'populations-open-endedness',
          label: 'Populations and Open-Ended Learning',
          description: 'Study the stability, curriculum, and diversity problems that appear when a population learns continuously inside a changing world.',
          concepts: [
            {
              title: 'Multi-Agent Non-Stationarity',
              description: 'Because other policies keep changing, the same action can produce different outcomes over time. Opponent histories, slower updates, population sampling, and centralized critics can improve stability.',
              tags: ['non-stationarity', 'stability', 'moving target'],
            },
            {
              title: 'Multi-Agent Credit Assignment',
              description: 'A team reward does not say which agent contributed what. Counterfactual baselines, difference rewards, and value decomposition help connect collective outcomes to individual behavior.',
              tags: ['credit assignment', 'team reward', 'value decomposition'],
            },
            {
              title: 'Population-Based Training',
              description: 'PBT trains many policies in parallel, periodically copying strong weights and mutating hyperparameters. It adapts both behavior and the training process while learning continues.',
              tags: ['PBT', 'population', 'hyperparameter evolution'],
            },
            {
              title: 'Curricula and Auto-Curricula',
              description: 'A curriculum orders tasks from achievable to difficult. An auto-curriculum generates new challenges from agent weaknesses, opponents, environment parameters, or unsolved frontiers.',
              tags: ['curriculum learning', 'auto-curriculum', 'task generation'],
            },
            {
              title: 'Open-Endedness and Intrinsic Motivation',
              description: 'Open-ended systems reward discovery, competence, surprise, or diversity rather than a single terminal score. The goal is a continuing stream of new skills, niches, and interactions.',
              tags: ['open-ended learning', 'intrinsic motivation', 'continual learning'],
            },
          ],
        },
      ],
    },
    {
      name: 'Evolutionary Computation',
      subclusters: [
        {
          id: 'genetic-algorithms',
          label: 'Genetic Algorithms',
          description: 'Learn the core evolutionary loop: encode candidates, evaluate a population, select parents, and generate varied descendants.',
          concepts: [
            {
              title: 'Genome and Phenotype',
              description: 'A genome is the representation inherited and modified by evolution; the phenotype is the resulting policy, body, or behavior. Good encodings make useful variation reachable.',
              tags: ['genome', 'phenotype', 'encoding'],
            },
            {
              title: 'Population Initialization',
              description: 'Initial diversity determines which regions of the search space evolution can explore early. Random, seeded, and archive-based initialization offer different coverage and prior knowledge.',
              tags: ['population', 'initialization', 'diversity'],
            },
            {
              title: 'Fitness Functions',
              description: 'Fitness ranks candidates for reproduction. It may measure task reward, survival, efficiency, novelty, cooperation, or several objectives, and it can be exploited just like an RL reward.',
              tags: ['fitness', 'objective', 'reward hacking'],
            },
            {
              title: 'Selection and Elitism',
              description: 'Selection gives stronger candidates more reproductive opportunity; elitism preserves top performers unchanged. Too much pressure collapses diversity, while too little slows improvement.',
              tags: ['selection', 'elitism', 'selection pressure'],
            },
            {
              title: 'Crossover and Mutation',
              description: 'Crossover recombines parent genomes; mutation introduces new variation. Their operators and rates must match the encoding so descendants remain viable and meaningfully different.',
              tags: ['crossover', 'mutation', 'variation'],
            },
          ],
        },
        {
          id: 'neuroevolution-quality-diversity',
          label: 'Neuroevolution and Quality Diversity',
          description: 'Move beyond a single fitness peak by evolving neural policies, preserving niches, and combining lifetime learning with population search.',
          concepts: [
            {
              title: 'Neuroevolution',
              description: 'Neuroevolution searches neural-network weights, architectures, or both using evolutionary operators. It avoids gradient requirements and can optimize sparse or discontinuous objectives.',
              tags: ['neuroevolution', 'neural policy', 'architecture search'],
            },
            {
              title: 'Evolution Strategies',
              description: 'Evolution strategies estimate useful search directions from a population of parameter perturbations. They parallelize well and offer a gradient-free alternative for policy optimization.',
              tags: ['evolution strategies', 'gradient-free', 'parallel search'],
            },
            {
              title: 'Speciation and Niching',
              description: 'Speciation protects meaningfully different candidates from immediate competition with the global best. Niching maintains multiple strategies, morphologies, and ecological roles.',
              tags: ['speciation', 'niching', 'diversity'],
            },
            {
              title: 'Novelty Search and MAP-Elites',
              description: 'Novelty search rewards behavioral difference. MAP-Elites stores the best candidate for each behavioral niche, producing a diverse archive of capable solutions instead of one champion.',
              tags: ['novelty search', 'MAP-Elites', 'quality diversity'],
            },
            {
              title: 'Evolution–Learning Hybrids',
              description: 'Evolution can set bodies, priors, architectures, rewards, or hyperparameters while RL adapts during a lifetime. Lamarckian variants inherit learned weights; Baldwinian variants inherit learning ability.',
              tags: ['Lamarckian evolution', 'Baldwin effect', 'hybrid learning'],
            },
          ],
        },
      ],
    },
    {
      name: 'Persistent San Francisco Lab',
      subclusters: [
        {
          id: 'embodiment-world-interface',
          label: 'Embodiment and World Interface',
          description: 'Translate learning abstractions into controllable bodies that can operate across the real geometry, physics, and activities of the San Francisco world.',
          concepts: [
            {
              title: 'Unified Training Environment API',
              description: 'Wrap the city as reset, observe, step, reward, and terminate functions. Keep simulation state separate from rendering so training can run headless, faster than real time, and in parallel.',
              tags: ['San Francisco', 'environment API', 'headless training'],
            },
            {
              title: 'Embodiment-Conditioned Policies',
              description: 'Walking, horses, cars, boats, boards, drones, and birds have different dynamics and controls. Share perception and goals where useful, then condition actions and motor skills on the active body.',
              tags: ['embodiment', 'locomotion', 'transfer learning'],
            },
            {
              title: 'Sensor and Observation Design',
              description: 'Combine local geometry queries, proprioception, contacts, goals, nearby agents, and optional vision. Normalize coordinates and expose only information an embodied agent could reasonably obtain.',
              tags: ['sensors', 'proprioception', 'perception'],
            },
            {
              title: 'Skill Decomposition',
              description: 'Build reusable skills for locomotion, jumping, navigation, mounting, object interaction, sports, and social behavior. A higher-level policy selects and sequences them across city-scale tasks.',
              tags: ['skills', 'hierarchy', 'long-horizon behavior'],
            },
            {
              title: 'Physics and Domain Randomization',
              description: 'Train against Box3D contacts, slopes, obstacles, and vehicle dynamics while varying friction, mass, delays, weather, spawn points, and sensor noise to reduce brittle behavior.',
              tags: ['Box3D', 'domain randomization', 'robustness'],
            },
          ],
        },
        {
          id: 'persistence-evaluation-safety',
          label: 'Persistence, Evaluation, and Safety',
          description: 'Design the infrastructure that lets populations accumulate experience, meet one another, improve safely, and remain understandable over long periods.',
          concepts: [
            {
              title: 'Persistent Agent Identity and State',
              description: 'Store each agent’s policy version, genome, skills, memory, relationships, inventory, and training lineage independently from transient browser sessions. Use versioned checkpoints and recoverable world snapshots.',
              tags: ['persistence', 'checkpoint', 'agent identity'],
            },
            {
              title: 'City-Scale Scenario Curriculum',
              description: 'Turn streamed terrain, hills, streets, parks, sports, animals, vehicles, fog, and encounters into parameterized scenarios. Sample by capability and weakness instead of always loading the whole city.',
              tags: ['San Francisco', 'scenario curriculum', 'world streaming'],
            },
            {
              title: 'Shared-World Interaction',
              description: 'Let trained agents and people inhabit the same relay-backed world while keeping authoritative training state on controlled services. Record encounters for learning without trusting clients as ground truth.',
              tags: ['multiplayer', 'human-agent interaction', 'shared world'],
            },
            {
              title: 'Evaluation, Telemetry, and Reproducibility',
              description: 'Track success, return, safety events, diversity, generalization, resource cost, and social outcomes. Preserve seeds, builds, policies, configs, and replayable trajectories for every evaluation.',
              tags: ['evaluation', 'telemetry', 'reproducibility'],
            },
            {
              title: 'Safe Continual Evolution',
              description: 'Separate experiments from the live world, cap actions and resources, test new policies against regression suites, retain rollback checkpoints, and promote agents only after behavioral review.',
              tags: ['AI safety', 'continual learning', 'governance', 'rollback'],
            },
          ],
        },
      ],
    },
  ],
  crossLinks: [
    ['Agent–Environment Interface', 'Unified Training Environment API'],
    ['Observations vs States', 'Sensor and Observation Design'],
    ['Actions and Control Spaces', 'Embodiment-Conditioned Policies'],
    ['Rewards, Returns, and Horizons', 'Fitness Functions'],
    ['Temporal Credit Assignment', 'Multi-Agent Credit Assignment'],
    ['Proximal Policy Optimization', 'Physics and Domain Randomization'],
    ['Replay Buffers and Target Networks', 'Persistent Agent Identity and State'],
    ['Imitation and Offline RL', 'Shared-World Interaction'],
    ['Model-Based RL and World Models', 'City-Scale Scenario Curriculum'],
    ['Hierarchical Reinforcement Learning', 'Skill Decomposition'],
    ['Self-Play and League Training', 'Curricula and Auto-Curricula'],
    ['Communication and Emergent Roles', 'Shared-World Interaction'],
    ['Population-Based Training', 'Evolution–Learning Hybrids'],
    ['Open-Endedness and Intrinsic Motivation', 'Novelty Search and MAP-Elites'],
    ['Genome and Phenotype', 'Persistent Agent Identity and State'],
    ['Neuroevolution', 'Embodiment-Conditioned Policies'],
    ['Speciation and Niching', 'Communication and Emergent Roles'],
    ['Evolution Strategies', 'Evaluation, Telemetry, and Reproducibility'],
    ['Physics and Domain Randomization', 'Safe Continual Evolution'],
  ],
  sources: [
    'Richard S. Sutton and Andrew G. Barto, Reinforcement Learning: An Introduction, second edition.',
    'John Schulman et al., Proximal Policy Optimization Algorithms.',
    'Ryan Lowe et al., Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments.',
    'Max Jaderberg et al., Population Based Training of Neural Networks.',
    'Kenneth O. Stanley and Risto Miikkulainen, Evolving Neural Networks through Augmenting Topologies.',
    'Jean-Baptiste Mouret and Jeff Clune, Illuminating Search Spaces by Mapping Elites.',
  ],
};

export const reinforcementLearningScene = buildScene(seed);
