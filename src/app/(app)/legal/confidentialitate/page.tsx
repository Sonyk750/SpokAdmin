import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Politica de confidențialitate (GDPR)" };

export default async function ConfidentialitatePage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  return (
    <div className="page-shell">
      <div className="legal">
        <h1 className="legal__title">Politica de confidențialitate (GDPR)</h1>
        <p className="legal__updated">Ultima actualizare: 22 iunie 2026</p>

        <div className="legal__note">
          ⚠️ Document orientativ, conform Regulamentului (UE) 2016/679 (GDPR). Completează datele
          operatorului și verifică-l cu un specialist în protecția datelor înainte de publicare.
        </div>

        <section className="legal__section">
          <h2 className="legal__h2">1. Operatorul de date</h2>
          <p>
            Aplicația <strong>SpokAdmin</strong> este operată de <strong>[Denumire firmă] SRL</strong>,
            CUI <strong>[CUI]</strong>, cu sediul în <strong>[adresă]</strong>, email de contact pentru
            protecția datelor: <strong>[email DPO/contact]</strong>. Prelucrăm date cu caracter personal cu
            respectarea Regulamentului (UE) 2016/679 (GDPR) și a legislației naționale aplicabile.
          </p>
        </section>

        <section className="legal__section">
          <h2 className="legal__h2">2. Ce date prelucrăm</h2>
          <p><strong>Date ale utilizatorilor aplicației (administratori):</strong></p>
          <ul>
            <li>Nume, adresă de email, parolă (stocată criptat), rol în organizație.</li>
          </ul>
          <p><strong>Date ale proprietarilor / locatarilor</strong> introduse de administrator:</p>
          <ul>
            <li>Nume și prenume, apartament, număr persoane.</li>
            <li>Date de contact: telefon, adresă de email.</li>
            <li>Date financiare: solduri, restanțe, încasări, contribuții la fonduri.</li>
          </ul>
        </section>

        <section className="legal__section">
          <h2 className="legal__h2">3. Scopul și temeiul prelucrării</h2>
          <ul>
            <li><strong>Furnizarea serviciului</strong> de administrare (executarea contractului).</li>
            <li><strong>Îndeplinirea obligațiilor legale</strong> ale asociației de proprietari (ex. Legea 196/2018, obligații contabile/fiscale).</li>
            <li><strong>Interesul legitim</strong> de a asigura funcționarea, securitatea și îmbunătățirea Aplicației.</li>
          </ul>
        </section>

        <section className="legal__section">
          <h2 className="legal__h2">4. Persoane împuternicite și acces la date</h2>
          <p>
            Pentru funcționarea Aplicației folosim furnizori de servicii (împuterniciți) care prelucrează date
            în numele nostru, cu garanții contractuale adecvate:
          </p>
          <ul>
            <li><strong>Găzduire aplicație</strong> — furnizor de hosting cloud (ex. Vercel).</li>
            <li><strong>Bază de date</strong> — furnizor de bază de date gestionată (ex. Neon), în UE.</li>
          </ul>
          <p>Nu vindem și nu închiriem datele personale către terți.</p>
        </section>

        <section className="legal__section">
          <h2 className="legal__h2">5. Stocare și securitate</h2>
          <p>
            Aplicăm măsuri tehnice și organizatorice adecvate: criptarea parolelor, acces pe bază de
            autentificare și roluri, conexiuni securizate (HTTPS), izolarea datelor pe organizație. Accesul la
            date este limitat la persoanele autorizate.
          </p>
        </section>

        <section className="legal__section">
          <h2 className="legal__h2">6. Durata păstrării</h2>
          <p>
            Păstrăm datele pe durata utilizării contului și ulterior pe perioada impusă de obligațiile legale
            (ex. documente financiar-contabile). La cerere, datele care nu fac obiectul unei obligații legale de
            păstrare pot fi șterse.
          </p>
        </section>

        <section className="legal__section">
          <h2 className="legal__h2">7. Drepturile persoanelor vizate</h2>
          <p>Conform GDPR, persoanele vizate au dreptul la:</p>
          <ul>
            <li>Acces la datele personale și informare privind prelucrarea.</li>
            <li>Rectificarea datelor inexacte sau incomplete.</li>
            <li>Ștergerea datelor („dreptul de a fi uitat”), în condițiile legii.</li>
            <li>Restricționarea prelucrării și opoziția la prelucrare.</li>
            <li>Portabilitatea datelor.</li>
            <li>Retragerea consimțământului, acolo unde prelucrarea se bazează pe acesta.</li>
          </ul>
          <p>
            Cererile se transmit la <strong>[email DPO/contact]</strong>. Ai dreptul de a depune o plângere la
            Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP).
          </p>
        </section>

        <section className="legal__section">
          <h2 className="legal__h2">8. Cookies</h2>
          <p>
            Folosim cookie-uri strict necesare pentru autentificare și menținerea sesiunii. Nu folosim cookie-uri
            de marketing în interiorul aplicației de administrare.
          </p>
        </section>

        <section className="legal__section">
          <h2 className="legal__h2">9. Responsabilitatea administratorului</h2>
          <p>
            Administratorul care introduce datele proprietarilor acționează, la rândul său, în calitate de
            operator/împuternicit pentru aceste date și este responsabil să informeze persoanele vizate și să
            obțină, acolo unde este cazul, temeiul legal pentru prelucrare.
          </p>
        </section>

        <section className="legal__section">
          <h2 className="legal__h2">10. Contact</h2>
          <p>
            Pentru orice întrebare privind protecția datelor: <strong>[email DPO/contact]</strong>.
            Vezi și <Link href="/legal/termeni">Termenii și condițiile de utilizare</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
