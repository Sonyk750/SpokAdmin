import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Termeni și condiții" };

export default async function TermeniPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  return (
    <div className="page-shell">
      <div className="legal">
        <h1 className="legal__title">Termeni și condiții de utilizare</h1>
        <p className="legal__updated">Ultima actualizare: 22 iunie 2026</p>

        <div className="legal__note">
          ⚠️ Document orientativ. Completează datele firmei (denumire, CUI, sediu, contact) și
          consultă un specialist juridic înainte de publicarea oficială.
        </div>

        <section className="legal__section">
          <h2 className="legal__h2">1. Acceptarea termenilor</h2>
          <p>
            Prin crearea unui cont și utilizarea aplicației <strong>SpokAdmin</strong> (denumită în continuare
            „Aplicația”), operată de <strong>[Denumire firmă] SRL</strong>, CUI <strong>[CUI]</strong>, cu sediul în
            <strong> [adresă]</strong> (denumit în continuare „Furnizorul”), confirmi că ai citit, ai înțeles și ești
            de acord cu prezentii termeni și condiții. Dacă nu ești de acord, te rugăm să nu utilizezi Aplicația.
          </p>
        </section>

        <section className="legal__section">
          <h2 className="legal__h2">2. Descrierea serviciului</h2>
          <p>
            Aplicația este o platformă software destinată administrării asociațiilor de proprietari:
            gestionarea apartamentelor și proprietarilor, facturilor, încasărilor, listelor de întreținere,
            fondurilor, registrelor contabile și a altor operațiuni specifice. Aplicația este un
            <strong> instrument de evidență</strong> și nu înlocuiește consultanța contabilă, fiscală sau juridică
            de specialitate.
          </p>
        </section>

        <section className="legal__section">
          <h2 className="legal__h2">3. Contul utilizatorului</h2>
          <ul>
            <li>Ești responsabil pentru păstrarea confidențialității datelor de autentificare (email și parolă).</li>
            <li>Ești responsabil pentru toate activitățile desfășurate prin contul tău.</li>
            <li>Ne anunți imediat dacă suspectezi o utilizare neautorizată a contului.</li>
          </ul>
        </section>

        <section className="legal__section">
          <h2 className="legal__h2">4. Obligațiile utilizatorului</h2>
          <ul>
            <li>Utilizezi Aplicația doar în scopuri legale și conform destinației ei.</li>
            <li>Introduci date corecte, complete și actualizate.</li>
            <li>Nu încerci să accesezi neautorizat sistemele, datele altor utilizatori sau codul sursă.</li>
            <li>Respecți drepturile persoanelor ale căror date le prelucrezi (vezi Politica de confidențialitate).</li>
          </ul>
        </section>

        <section className="legal__section">
          <h2 className="legal__h2">5. Răspunderea privind datele și calculele</h2>
          <p>
            Utilizatorul (administratorul) este <strong>singurul responsabil</strong> pentru corectitudinea datelor
            introduse, pentru deciziile luate pe baza informațiilor din Aplicație și pentru conformitatea cu
            legislația aplicabilă (inclusiv Legea nr. 196/2018 privind asociațiile de proprietari). Furnizorul nu
            răspunde pentru erorile rezultate din date introduse greșit, incomplete sau neactualizate.
          </p>
        </section>

        <section className="legal__section">
          <h2 className="legal__h2">6. Limitarea răspunderii</h2>
          <p>
            Aplicația este furnizată „ca atare” și „așa cum este disponibilă”, fără garanții de orice fel.
            În limitele permise de lege, Furnizorul nu răspunde pentru daune indirecte, pierderi de date,
            de profit sau de oportunitate rezultate din utilizarea sau imposibilitatea utilizării Aplicației.
            Furnizorul depune eforturi rezonabile pentru disponibilitatea și securitatea serviciului, dar nu
            garantează funcționarea neîntreruptă sau lipsită de erori.
          </p>
        </section>

        <section className="legal__section">
          <h2 className="legal__h2">7. Disponibilitatea serviciului</h2>
          <p>
            Furnizorul poate efectua mentenanță, actualizări sau modificări ale Aplicației, cu sau fără notificare
            prealabilă. Pot exista perioade de indisponibilitate temporară. Recomandăm efectuarea periodică de
            exporturi/copii ale datelor importante.
          </p>
        </section>

        <section className="legal__section">
          <h2 className="legal__h2">8. Proprietate intelectuală</h2>
          <p>
            Aplicația, codul sursă, designul, mărcile și conținutul aferent aparțin Furnizorului și sunt protejate
            de legislația privind drepturile de autor și proprietatea intelectuală. Datele introduse de utilizator
            rămân proprietatea acestuia.
          </p>
        </section>

        <section className="legal__section">
          <h2 className="legal__h2">9. Modificarea termenilor</h2>
          <p>
            Furnizorul își rezervă dreptul de a modifica acești termeni. Modificările intră în vigoare la data
            publicării în Aplicație. Utilizarea continuă a Aplicației după modificare constituie acceptarea noilor
            termeni.
          </p>
        </section>

        <section className="legal__section">
          <h2 className="legal__h2">10. Legea aplicabilă și contact</h2>
          <p>
            Prezentii termeni sunt guvernați de legea română. Eventualele litigii se soluționează pe cale amiabilă
            sau, în caz contrar, de instanțele competente din România. Pentru întrebări:
            <strong> [email contact]</strong>.
          </p>
          <p>
            Vezi și <Link href="/legal/confidentialitate">Politica de confidențialitate (GDPR)</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
