import type { Metadata } from "next";
import "../styles/globals.scss";

export const metadata: Metadata = {
  metadataBase: new URL("https://spokadmin.ro"),
  title: {
    default: "SpokAdmin | Software de administrare asociatii de proprietari",
    template: "%s | SpokAdmin",
  },
  description:
    "SpokAdmin este platforma completa de administrare pentru asociatii de proprietari: liste de plata, contabilitate, registre, e-Factura ANAF, incasari online si rapoarte. 100% in cloud, conform legislatiei din Romania.",
  keywords: [
    "software administrare asociatii de proprietari",
    "program administrare bloc",
    "aplicatie administrare imobile",
    "liste de plata asociatie",
    "program contabilitate asociatie proprietari",
    "e-factura anaf asociatie",
    "software administrator imobile",
    "registru fond rulment online",
    "platforma administrare cladiri",
    "program intretinere bloc",
  ],
  authors: [{ name: "SpokAdmin", url: "https://spokadmin.ro" }],
  creator: "SpokAdmin",
  publisher: "SpokAdmin",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "ro_RO",
    url: "https://spokadmin.ro",
    siteName: "SpokAdmin",
    title: "SpokAdmin | Software de administrare asociatii de proprietari",
    description:
      "Platforma completa de administrare asociatii: liste de plata, contabilitate, e-Factura ANAF, incasari online si rapoarte. 100% in cloud, conform legislatiei din Romania.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "SpokAdmin — Software de administrare asociatii de proprietari",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SpokAdmin | Software de administrare asociatii de proprietari",
    description:
      "Liste de plata, contabilitate, e-Factura ANAF, incasari online si rapoarte — intr-o singura platforma. 100% in cloud.",
    images: ["/og-image.jpg"],
  },
  alternates: {
    canonical: "https://spokadmin.ro",
  },
  category: "Business Software",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": "https://spokadmin.ro/#app",
      name: "SpokAdmin",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Platforma completa de administrare pentru asociatii de proprietari: liste de plata, contabilitate, registre, e-Factura ANAF, incasari online, contoare, salarizare si rapoarte — 100% in cloud, conform legislatiei din Romania.",
      url: "https://spokadmin.ro",
      inLanguage: "ro-RO",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "RON",
        description: "Plan Start gratuit 14 zile, fara card.",
      },
      featureList: [
        "Liste de plata si intretinere",
        "Contabilitate si registre (casa, banca, jurnal, fond rulment)",
        "e-Factura ANAF (SPV)",
        "Incasari si plati online",
        "Contoare si repartizare consum",
        "Salarizare si declaratii",
        "Rapoarte si export PDF",
        "Asistent AI",
        "Platforma pentru proprietari",
      ],
      publisher: { "@id": "https://spokadmin.ro/#org" },
    },
    {
      "@type": "Organization",
      "@id": "https://spokadmin.ro/#org",
      name: "SpokAdmin",
      url: "https://spokadmin.ro",
      email: "office@spokadmin.ro",
      areaServed: { "@type": "Country", name: "Romania" },
      sameAs: ["https://spokadmin.ro"],
    },
    {
      "@type": "WebSite",
      "@id": "https://spokadmin.ro/#website",
      url: "https://spokadmin.ro",
      name: "SpokAdmin",
      description: "Software de administrare asociatii de proprietari",
      publisher: { "@id": "https://spokadmin.ro/#org" },
      inLanguage: "ro-RO",
    },
    {
      "@type": "FAQPage",
      "@id": "https://spokadmin.ro/#faq",
      mainEntity: [
        {
          "@type": "Question",
          name: "Pentru cine este SpokAdmin?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Pentru administratori de imobile, firme de administrare si asociatii de proprietari care vor sa digitalizeze complet activitatea financiara, contabila si fiscala — de la liste de plata pana la e-Factura ANAF.",
          },
        },
        {
          "@type": "Question",
          name: "Trebuie sa instalez ceva?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Nu. SpokAdmin ruleaza 100% in browser, pe orice dispozitiv. Datele sunt pastrate in cloud, securizate si salvate automat.",
          },
        },
        {
          "@type": "Question",
          name: "Este conform cu legislatia din Romania?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Da. Registrele, listele de plata si declaratiile respecta legislatia asociatiilor de proprietari, iar modulul fiscal este conectat la cerintele ANAF.",
          },
        },
        {
          "@type": "Question",
          name: "Pot administra mai multe asociatii?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Da. Poti gestiona oricate asociatii dintr-un singur cont, cu comutare rapida intre ele si date complet separate.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <meta name="theme-color" content="#080A0F" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body>{children}</body>
    </html>
  );
}
