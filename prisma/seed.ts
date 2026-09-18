import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ACHIEVEMENTS = [
  { key: "streak-7", name: "7 Day Streak", description: "Study on 7 consecutive days." },
  { key: "streak-30", name: "30 Day Streak", description: "Study on 30 consecutive days." },
  { key: "pomodoros-100", name: "100 Pomodoros", description: "Complete 100 Pomodoro sessions." },
  { key: "first-subject", name: "First Subject Completed", description: "Finish every topic in a subject." },
  { key: "questions-500", name: "500 Questions", description: "Solve 500 practice questions." },
  { key: "study-5h-day", name: "5 Hour Study Day", description: "Log at least 5 hours in a single day." },
  { key: "syllabus-complete", name: "Entire Syllabus Completed", description: "Complete every topic in your syllabus." },
];

async function main() {
  for (const achievement of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { key: achievement.key },
      update: { name: achievement.name, description: achievement.description },
      create: achievement,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
