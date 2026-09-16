Agent Tank Hackathon: 4 days to go 🔨
Hi @Neurobuilder ! We’ve collected answers to the questions that came up during the first week. Here’s what you need to know for the final stretch.

Deploy on Studio Next
Your project must be deployed on Studio Next to be accepted into the hackathon. It includes the latest features, including fees.

Network: Studio Next
RPC: https://studio-next.genlayer.com/api
Chain ID: 61997
Explorer: https://explorer-studio-dev.genlayer.com/
Migration notes: https://docs.genlayer.com/developers/consensus-v06-migration#test-on-studio-dev-first

Transaction Kit RC2 is out, and the boilerplate’s v2-dev branch already uses it:
https://github.com/genlayerlabs/genlayer-project-boilerplate/tree/v2-dev

For a new project, clone v2-dev, run npm ci, copy frontend/.env.example to frontend/.env, and set your deployed contract address.

For an existing app, install @genlayer/transaction-kit@0.1.0-rc.2 and the React or Vue adapter at the same version, alongside genlayer-js@2.0.0-rc.1.

These are prerelease versions; tests, build, and CI are green.

Submit early and keep improving
You can submit through the Portal at any time during the build period. Don’t wait for the deadline.

Your public hackathon entry can receive community ratings and comments while it is still under review. You don’t need to wait for acceptance to start getting feedback. Publication in the main Project Explorer is a separate review decision.

During the build period, portal reviewers may request more information or changes. If your submission shows “Action needed,” read the reviewer’s note, update your project, and respond with what changed. Submitting early gives you more time to work through that process.

Include a demo video
A demo video is mandatory for this hackathon, even though the shared Portal form currently labels that field optional.

Show what your app does, explain what’s happening, and help someone understand it before trying it.

Check more than lint and tests
Passing lint and tests is a starting point, not a guarantee of acceptance. Before submitting, ask yourself:

Does my app actually call a real GenLayer contract?
Why does decentralized judgment matter to this problem?
Does the contract maintain meaningful state, and does its validator check the meaningful outcome?
Does the repository build and work?
What have I built beyond the starter or boilerplate?
Can someone use the frontend and follow clear instructions to verify the result?

These reflect the Portal’s existing project-review criteria. The Portal’s Resources page also points to GenLayer contract-writing skills covering validation patterns and anti-patterns. If you’re unsure about a design decision, ask in the community channels early.

How judging works
The judging team will review a shortlist of the top 20 projects, potentially more, informed by community star ratings and comments.

Portal submission review and final hackathon judging are separate stages. Use the build period to resolve review requests and gather feedback while you can still act on it.

Share your project inside and outside the community. Get real people to try it, rate it, and leave useful comments.

Test each other’s projects, too. Honest ratings and specific feedback help builders improve and make community review more useful for everyone.

Points go to accepted projects, as always.

We’re excited to see how your projects evolve. One week to go, build something people use! 🫡