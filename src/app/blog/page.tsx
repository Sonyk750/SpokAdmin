import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "../components/Logo";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog — Administrare asociatii de proprietari, AI in lista de plata si e-Factura",
  description:
    "Ghiduri practice despre administrarea asociatiilor de proprietari: lista de plata cu AI, software de administrare, e-Factura ANAF, fond de rulment, registre si cenzorat. Resurse scrise de echipa SpokAdmin.",
  keywords: [
    "blog administrare asociatii de proprietari",
    "lista de plata cu AI",
    "software administrare bloc",
    "e-factura anaf asociatie",
    "fond de rulment asociatie",
    "cenzorat asociatii proprietari",
  ],
  alternates: { canonical: "https://spokadmin.ro/blog" },
  openGraph: {
    type: "website",
    locale: "ro_RO",
    url: "https://spokadmin.ro/blog",
    siteName: "SpokAdmin",
    title: "Blog SpokAdmin — administrare asociatii de proprietari",
    description:
      "Ghiduri despre lista de plata cu AI, software de administrare, e-Factura ANAF, fond de rulment, registre si cenzorat.",
  },
};

const categoryClass: Record<string, string> = {
  "Inteligenta Artificiala": "blog-tag--cyan",
  "Administrare Imobile": "blog-tag--violet",
  "e-Factura ANAF": "blog-tag--cyan",
  "Contabilitate": "blog-tag--violet",
};

export default function BlogIndexPage() {
  const posts = getAllPosts();

  const itemList = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": "https://spokadmin.ro/blog#blog",
    name: "Blog SpokAdmin",
    url: "https://spokadmin.ro/blog",
    inLanguage: "ro-RO",
    publisher: { "@id": "https://spokadmin.ro/#org" },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      description: p.description,
      datePublished: p.date,
      url: `https://spokadmin.ro/blog/${p.slug}`,
      keywords: p.keywords.join(", "),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />

      <div className="bg-scene">
        <div className="bg-scene__violet" />
        <div className="bg-scene__cyan" />
        <div className="bg-scene__grid" />
      </div>

      <main className="page-main">
        <header className="header">
          <div className="header__inner">
            <Link href="/"><Logo height={42} /></Link>
            <nav className="header__nav">
              <Link href="/#functionalitati">Functionalitati</Link>
              <Link href="/#preturi">Preturi</Link>
              <Link href="/blog">Blog</Link>
            </nav>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Link href="/login" className="btn btn--secondary" style={{ padding: "0.625rem 1.25rem", fontSize: "0.8125rem" }}>
                Conectare
              </Link>
              <Link href="/register" className="btn btn--primary header__cta">
                Incepe gratuit
              </Link>
            </div>
          </div>
        </header>

        <section className="section" style={{ paddingTop: "8rem" }}>
          <div className="container">
            <div className="section-intro section-intro--center">
              <p className="section-label section-label--violet">Blog SpokAdmin</p>
              <h1 className="section-heading">
                Resurse pentru<br /><span className="gradient">administrarea asociatiei</span>
              </h1>
              <p className="section-desc" style={{ margin: "1rem auto 0", textAlign: "center" }}>
                Ghiduri practice despre lista de plata cu AI, software de administrare, e-Factura ANAF, fond de rulment, registre si cenzorat.
              </p>
            </div>

            <div className="blog-grid">
              {posts.map((post) => (
                <Link key={post.slug} href={`/blog/${post.slug}`} className="blog-card">
                  <div className="blog-card__top">
                    <span className={`blog-tag ${categoryClass[post.category] ?? "blog-tag--violet"}`}>
                      {post.category}
                    </span>
                    <span className="blog-card__time">{post.readTime} citire</span>
                  </div>
                  <h2 className="blog-card__title">{post.title}</h2>
                  <p className="blog-card__desc">{post.description}</p>
                  <div className="blog-card__foot">
                    <span className="blog-card__date">
                      {new Date(post.date).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                    <span className="blog-card__more">Citeste →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <footer className="footer">
          <div className="container">
            <div className="footer__bottom" style={{ borderTop: "none", paddingTop: 0 }}>
              <span>© 2026 SpokAdmin — Software de administrare asociatii de proprietari</span>
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                <Link href="/">Acasa</Link>
                <a href="https://spokapp.ro" target="_blank" rel="noopener">SpokApp</a>
                <a href="https://spokinvoice.ro" target="_blank" rel="noopener">SpokInvoice</a>
                <a href="https://vosmart.ro" target="_blank" rel="noopener">VoSmart</a>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
