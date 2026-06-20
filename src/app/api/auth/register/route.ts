import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, companyName } = await req.json();

    if (!name || !email || !password || !companyName) {
      return NextResponse.json({ error: "Completează toate câmpurile." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Parola trebuie să aibă minim 8 caractere." }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Adresa de email este deja înregistrată." }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 12);

    // Base slug from company name, ensure uniqueness
    let slug = slugify(companyName);
    const slugExists = await db.organization.findUnique({ where: { slug } });
    if (slugExists) slug = `${slug}-${Date.now()}`;

    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: "USER",
        isActive: true,
        memberships: {
          create: {
            role: "OWNER",
            organization: {
              create: {
                name:   companyName,
                slug,
                plan:   "starter",
                status: "active",
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ success: true, userId: user.id });
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json({ error: "Eroare internă. Încearcă din nou." }, { status: 500 });
  }
}
