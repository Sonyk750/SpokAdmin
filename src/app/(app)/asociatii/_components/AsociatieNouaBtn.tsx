"use client";

import { useState } from "react";
import AsociatieModal from "./AsociatieModal";

export default function AsociatieNouaBtn({ primary }: { primary?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`btn ${primary ? "btn--primary btn--lg" : "btn--primary"}`}
      >
        + Asociație nouă
      </button>
      {open && <AsociatieModal onClose={() => setOpen(false)} />}
    </>
  );
}
