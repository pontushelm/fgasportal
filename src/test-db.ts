import { prisma } from "../lib/db"

async function test() {
  try {
    const companies = await prisma.company.findMany()
    console.log("Companies:", companies)
  } catch (error) {
    console.error("Database error:", error)
  }
}

test()
