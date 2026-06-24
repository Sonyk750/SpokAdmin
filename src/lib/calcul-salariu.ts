// Calcule salariale România 2025
// CAS: 25%, CASS: 10%, Impozit venit: 10%, CAM angajator: 2.25%

const r2 = (v: number) => Math.round(v * 100) / 100

export interface InputSalariu {
  salariuBrut:      number   // brut lunar contractual
  zileLucratoareLuna: number // zile lucratoare in luna respectiva (ex: 21)
  zileLucrate:      number   // zile efectiv lucrate
  oreSupliment:     number   // ore suplimentare
  deducere:         number   // deducere personala lunara (RON)
  altRetineri:      number   // alte retineri (popriri, avansuri etc)
  normaDeLucru:     number   // ore/zi (8 de obicei)
}

export interface RezultatSalariu {
  salariuBrut:   number
  cas:           number
  cass:          number
  bazaImpozit:   number
  impozit:       number
  altRetineri:   number
  salariuNet:    number
  cam:           number   // contributia angajatorului
}

export function calculeazaSalariu(input: InputSalariu): RezultatSalariu {
  const { salariuBrut, zileLucratoareLuna, zileLucrate, oreSupliment,
          deducere, altRetineri, normaDeLucru } = input

  const zile = Math.max(0, zileLucratoareLuna)

  // Salariu proporțional cu zilele lucrate
  const brutZi    = zile > 0 ? salariuBrut / zile : 0
  let   brutLunar = r2(brutZi * Math.min(zileLucrate, zile))

  // Ore suplimentare: 175% din salariul orar
  if (oreSupliment > 0 && zile > 0) {
    const brutOrar = salariuBrut / (zile * normaDeLucru)
    brutLunar      = r2(brutLunar + oreSupliment * brutOrar * 1.75)
  }

  const cas        = r2(brutLunar * 0.25)
  const cass       = r2(brutLunar * 0.10)
  const bazaImpozit = Math.max(0, r2(brutLunar - cas - cass - deducere))
  const impozit    = r2(bazaImpozit * 0.10)
  const net        = r2(brutLunar - cas - cass - impozit - altRetineri)
  const cam        = r2(brutLunar * 0.0225)

  return {
    salariuBrut:  brutLunar,
    cas,
    cass,
    bazaImpozit,
    impozit,
    altRetineri,
    salariuNet:   Math.max(0, net),
    cam,
  }
}

// Zile lucratoare standard pe luna (fara sarbatori legale)
// In practica, administratorul introduce manual — acesta e default-ul
export function zileLucratoareDefault(luna: number, an: number): number {
  const zileInLuna = new Date(an, luna, 0).getDate()
  let lucratoare   = 0
  for (let z = 1; z <= zileInLuna; z++) {
    const zi = new Date(an, luna - 1, z).getDay()
    if (zi !== 0 && zi !== 6) lucratoare++
  }
  return lucratoare
}
