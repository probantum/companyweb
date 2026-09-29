// Static marketing copy that mirrors the "Dark Network" design exactly.
// Not admin-managed (the design has no CMS screen for these).

const services = [
  {
    icon: 'svcData',
    tag: 'Data Science',
    name: 'Data Science & Analytics',
    desc: 'Scalable pipelines, predictive models, and real-time decision dashboards that turn raw enterprise data into compounding advantage.',
  },
  {
    icon: 'svcAi',
    tag: 'AI',
    name: 'Artificial Intelligence',
    desc: 'LLM fine-tuning, computer vision, and reinforcement learning — deployed at production grade with full MLOps scaffolding.',
  },
  {
    icon: 'svcFintech',
    tag: 'FinTech',
    name: 'FinTech Platforms',
    desc: 'Regulated payment rails, algorithmic trading engines, and digital banking infrastructure — compliance-first by design.',
  },
  {
    icon: 'svcCloud',
    tag: 'Cloud',
    name: 'Cloud & MLOps',
    desc: 'Feature stores, model registries, and CI/CD for models across AWS, GCP, and Azure with 99.97% SLA.',
  },
  {
    icon: 'svcRisk',
    tag: 'Risk',
    name: 'Compliance & Risk AI',
    desc: 'Fraud detection, AML/KYC, and explainable AI systems that satisfy regulators and protect your business.',
  },
  {
    icon: 'svcAdvisory',
    tag: 'Advisory',
    name: 'Advisory & Strategy',
    desc: 'AI roadmaps, vendor evaluations, and transformation programmes for leadership teams.',
  },
];

const metrics = [
  { value: '40+', label: 'Systems shipped to production' },
  { value: '12', label: 'Countries served' },
  { value: '99.9%', label: 'Uptime SLA across platforms' },
  { value: '$280M+', label: 'Transaction volume processed' },
];

module.exports = { services, metrics };
