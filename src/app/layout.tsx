import type { Metadata } from "next";
import "../styles/globals.scss";

export const metadata: Metadata = {
  metadataBase: new URL("https://decoimob.ro"),
  title: {
    default: "DecoImob | Administrare Imobile si Blocuri Bucuresti",
    template: "%s | DecoImob — Administrare Imobile Bucuresti",
  },
  description:
    "DecoImob — firma de administrare imobile si blocuri in Bucuresti si Ilfov. Property management profesional: colectare chirii, mentenanta tehnica, suport juridic ANAF. 20+ ani experienta. Oferta gratuita.",
  keywords: [
    "administrare imobile bucuresti",
    "administrare blocuri bucuresti",
    "firma de administrare imobile",
    "property management bucuresti",
    "administrare asociatie proprietari",
    "administrator imobile sector 1",
    "administrator imobile sector 2",
    "administrator imobile sector 3",
    "administrator imobile ilfov",
    "administrare cladiri rezidentiale",
    "servicii administrare imobile",
    "administrator autorizat bucuresti",
  ],
  authors: [{ name: "DecoImob SRL", url: "https://decoimob.ro" }],
  creator: "DecoImob SRL",
  publisher: "DecoImob SRL",
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
    url: "https://decoimob.ro",
    siteName: "DecoImob — Administrare Imobile Bucuresti",
    title: "DecoImob | Firma de Administrare Imobile si Blocuri Bucuresti",
    description:
      "Administrare imobile si blocuri in Bucuresti si Ilfov. Property management profesional cu 20+ ani experienta. Colectare chirii, mentenanta tehnica, suport juridic. Oferta gratuita.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "DecoImob — Administrare Imobile Profesionala Bucuresti",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DecoImob | Administrare Imobile Bucuresti",
    description:
      "Firma de administrare imobile si blocuri in Bucuresti si Ilfov. Property management profesional, 20+ ani experienta.",
    images: ["/og-image.jpg"],
  },
  alternates: {
    canonical: "https://decoimob.ro",
  },
  category: "Real Estate",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "LocalBusiness",
      "@id": "https://decoimob.ro/#business",
      name: "DecoImob SRL",
      alternateName: "DecoImob",
      description:
        "Firma de administrare imobile si blocuri in Bucuresti si Ilfov. Servicii profesionale de property management: colectare chirii, mentenanta tehnica, suport juridic ANAF, platforma digitala proprietari.",
      url: "https://decoimob.ro",
      telephone: "+40756362828",
      email: "office@decoimob.ro",
      foundingDate: "2005",
      areaServed: [
        { "@type": "City", name: "Bucuresti" },
        { "@type": "AdministrativeArea", name: "Ilfov" },
      ],
      address: {
        "@type": "PostalAddress",
        addressLocality: "Bucuresti",
        addressCountry: "RO",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: 44.4268,
        longitude: 26.1025,
      },
      openingHoursSpecification: {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday"],
        opens: "09:00",
        closes: "18:00",
      },
      sameAs: ["https://decoimob.ro"],
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Servicii Administrare Imobile",
        itemListElement: [
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Administrare Financiara Imobile",
              description: "Colectare chirii, liste de plata, rapoarte lunare, reconciliere bancara si declaratii fiscale ANAF.",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Administrare Tehnica Blocuri",
              description: "Coordonare lucrari, mentenanta preventiva, interventii urgente, verificari periodice instalatii.",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Suport Juridic Asociatii Proprietari",
              description: "Contracte conforme, recuperare creante, mediere conflicte, reprezentare ANAF.",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Platforma Digitala Property Management",
              description: "Dashboard live 24/7 pentru proprietari: plati online, documente, sesizari, rapoarte.",
            },
          },
        ],
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.9",
        reviewCount: "87",
        bestRating: "5",
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://decoimob.ro/#website",
      url: "https://decoimob.ro",
      name: "DecoImob — Administrare Imobile Bucuresti",
      description: "Firma de administrare imobile si blocuri in Bucuresti si Ilfov",
      publisher: { "@id": "https://decoimob.ro/#business" },
      inLanguage: "ro-RO",
    },
    {
      "@type": "WebPage",
      "@id": "https://decoimob.ro/#webpage",
      url: "https://decoimob.ro",
      name: "Administrare Imobile Bucuresti | DecoImob — Property Management",
      isPartOf: { "@id": "https://decoimob.ro/#website" },
      about: { "@id": "https://decoimob.ro/#business" },
      description:
        "DecoImob ofera servicii complete de administrare imobile si blocuri in Bucuresti si Ilfov: financiar, tehnic, juridic si platforma digitala.",
      inLanguage: "ro-RO",
    },
    {
      "@type": "FAQPage",
      "@id": "https://decoimob.ro/#faq",
      mainEntity: [
        {
          "@type": "Question",
          name: "Ce inseamna administrarea unui bloc?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Administrarea unui bloc include colectarea fondului de rulment si intretinere, gestionarea furnizorilor de utilitati, coordonarea lucrarilor tehnice, tinerea evidentei contabile si comunicarea cu proprietarii. O firma de administrare profesionista preia toate aceste responsabilitati.",
          },
        },
        {
          "@type": "Question",
          name: "Cat costa serviciile de property management?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Costul administrarii imobilelor variaza in functie de numarul de unitati si serviciile alese. DecoImob ofera tarife transparente: 50-90 EUR/luna pentru 1-20 apartamente si 70-110 EUR/luna pentru 20-40 apartamente, fara costuri ascunse.",
          },
        },
        {
          "@type": "Question",
          name: "In ce zone din Bucuresti oferiti servicii de administrare imobile?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Oferim servicii de administrare imobile si administrare blocuri in toate sectoarele Bucurestiului (Sector 1, 2, 3, 4, 5, 6) si in judetul Ilfov. Portofoliul nostru include blocuri rezidentiale, imobile de birouri si ansambluri rezidentiale.",
          },
        },
        {
          "@type": "Question",
          name: "Cum preluati administrarea unui imobil?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Procesul de preluare dureaza maximum 48 de ore: consultatie gratuita, analiza situatiei, digitalizarea contractelor existente si configurarea platformei digitale. Nu exista angajamente initiale.",
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
        <meta name="geo.region" content="RO-B" />
        <meta name="geo.placename" content="Bucuresti" />
        <meta name="geo.position" content="44.4268;26.1025" />
        <meta name="ICBM" content="44.4268, 26.1025" />
        <meta name="theme-color" content="#080A0F" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body>{children}</body>
    </html>
  );
}
