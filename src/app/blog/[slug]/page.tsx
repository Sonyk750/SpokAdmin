import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "../../components/Logo";
import { getAllPosts, getPost, getPostSlugs } from "@/lib/blog";

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: `https://spokadmin.ro/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://spokadmin.ro/blog/${slug}`,
      type: "article",
      locale: "ro_RO",
      siteName: "SpokAdmin",
      publishedTime: post.date,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

const categoryClass: Record<string, string> = {
  "Inteligenta Artificiala": "blog-tag--cyan",
  "Administrare Imobile": "blog-tag--violet",
  "e-Factura ANAF": "blog-tag--cyan",
  "Contabilitate": "blog-tag--violet",
};

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const related = getAllPosts().filter((p) => p.slug !== slug).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `https://spokadmin.ro/blog/${slug}#article`,
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        dateModified: post.date,
        inLanguage: "ro-RO",
        keywords: post.keywords.join(", "),
        articleSection: post.category,
        url: `https://spokadmin.ro/blog/${slug}`,
        mainEntityOfPage: { "@type": "WebPage", "@id": `https://spokadmin.ro/blog/${slug}` },
        author: { "@type": "Organization", name: "SpokAdmin", url: "https://spokadmin.ro" },
        publisher: { "@id": "https://spokadmin.ro/#org" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Acasa", item: "https://spokadmin.ro" },
          { "@type": "ListItem", position: 2, name: "Blog", item: "https://spokadmin.ro/blog" },
          { "@type": "ListItem", position: 3, name: post.title, item: `https://spokadmin.ro/blog/${slug}` },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `https://spokadmin.ro/blog/${slug}#faq`,
        mainEntity: post.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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

        <article className="section" style={{ paddingTop: "8rem" }}>
          <div className="container blog-article">
            <Link href="/blog" className="blog-back">← Toate articolele</Link>

            <div className="blog-article__head">
              <div className="blog-article__meta">
                <span className={`blog-tag ${categoryClass[post.category] ?? "blog-tag--violet"}`}>{post.category}</span>
                <span className="blog-card__time">{post.readTime} citire</span>
                <span className="blog-card__date">
                  {new Date(post.date).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
              <h1 className="blog-article__title">{post.title}</h1>
              <p className="blog-article__lead">{post.description}</p>
            </div>

            <div className="blog-divider" />

            <div className="prose-blog" dangerouslySetInnerHTML={{ __html: post.content }} />

            {post.faq.length > 0 && (
              <div className="blog-faq">
                <h2>Intrebari frecvente</h2>
                {post.faq.map((f, i) => (
                  <div key={i} className="blog-faq__item">
                    <h3 className="blog-faq__q">{f.q}</h3>
                    <p className="blog-faq__a">{f.a}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="blog-cta">
              <h3>Incearca SpokAdmin gratuit</h3>
              <p>Administrare, lista de plata cu AI, e-Factura ANAF si rapoarte — intr-o singura platforma.</p>
              <Link href="/register" className="btn btn--primary">Incepe gratuit →</Link>
            </div>

            <div className="blog-related">
              <p className="section-label section-label--violet">Citeste si</p>
              <div className="blog-related__grid">
                {related.map((p) => (
                  <Link key={p.slug} href={`/blog/${p.slug}`} className="blog-related__card">
                    <span className={`blog-tag ${categoryClass[p.category] ?? "blog-tag--violet"}`}>{p.category}</span>
                    <span className="blog-related__title">{p.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </article>

        <footer className="footer">
          <div className="container">
            <div className="footer__bottom" style={{ borderTop: "none", paddingTop: 0 }}>
              <span>© 2026 SpokAdmin — Software de administrare asociatii de proprietari</span>
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                <Link href="/blog">Blog</Link>
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
