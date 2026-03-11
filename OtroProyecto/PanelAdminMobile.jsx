import { useEffect, useState } from "react";
import { db, auth } from "../firebaseConfig";
import {
  collection,
  onSnapshot,
  query,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  where,
  setDoc,
} from "firebase/firestore";
import Horarios from "../components/Horarios";
import Citas from "../components/Citas";
import Barra from "../components/Barra";
import GestionServicios from "../components/GestionServicios";

const VISTAS = {
  CITAS: "citas",
  HORARIO: "horario",
  SERVICIOS: "servicios",
};

const PanelAdminMobile = ({ businessData }) => {
  const [activeVista, setActiveVista] = useState(VISTAS.CITAS);
  const hoy = new Date().toISOString().split("T")[0];
  const [citasAgenda, setCitasAgenda] = useState([]);
  const [fechaBloqueo, setFechaBloqueo] = useState(hoy);
  const [bloqueos, setBloqueos] = useState([]);
  const [menuAbierto, setMenuAbierto] = useState(null);
  const [perfilUsuario, setPerfilUsuario] = useState(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);

  const profesionalId = auth.currentUser?.uid;
  const esAdmin = perfilUsuario?.rol === "admin";

  // Cargar Perfil
  useEffect(() => {
    if (!profesionalId) return;
    const obtenerPerfil = async () => {
      try {
        const docRef = doc(db, "profesionales", profesionalId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setPerfilUsuario(docSnap.data());
      } catch (e) {
        console.error(e);
      } finally {
        setCargandoPerfil(false);
      }
    };
    obtenerPerfil();
  }, [profesionalId]);

  // Listeners Agenda
  useEffect(() => {
    if (!profesionalId || !businessData) return;
    const qCitas = query(
      collection(db, "citas"),
      where("negocioId", "==", businessData.id),
      where("profesionalId", "==", profesionalId),
      where("fechaCita", "==", fechaBloqueo),
    );

    const qBloqueos = query(
      collection(db, "bloqueos"),
      where("negocioId", "==", businessData.id),
      where("profesionalId", "==", profesionalId),
      where("fecha", "==", fechaBloqueo),
    );

    const unsubCitas = onSnapshot(qCitas, (snap) => {
      setCitasAgenda(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubBloqueos = onSnapshot(qBloqueos, (snap) => {
      setBloqueos(snap.docs.map((d) => d.data().hora));
    });
    return () => {
      unsubCitas();
      unsubBloqueos();
    };
  }, [profesionalId, fechaBloqueo, businessData]);

  const toggleBloqueo = async (hora) => {
    const idBloqueo = `${businessData.id}_${profesionalId}_${fechaBloqueo}_${hora.replace(":", "")}`;
    const docRef = doc(db, "bloqueos", idBloqueo);
    if (bloqueos.includes(hora)) {
      await deleteDoc(docRef);
    } else {
      await setDoc(docRef, {
        negocioId: businessData.id,
        fecha: fechaBloqueo,
        hora,
        profesionalId,
      });
    }
  };

  const gestionarCita = async (cita, nuevoEstado) => {
    const mensajes = {
      confirmada: `Hola ${cita.clienteNombre}, confirmo tu cita...`,
      cancelada: `Hola ${cita.clienteNombre}, cancelamos tu cita...`,
      contacto: `Hola ${cita.clienteNombre}, te contacto por tu cita...`,
    };
    if (["contacto", "confirmada", "cancelada"].includes(nuevoEstado)) {
      window.location.href = `https://wa.me/${cita.clienteTelefono}?text=${encodeURIComponent(mensajes[nuevoEstado])}`;
    }
    if (nuevoEstado !== "contacto")
      await updateDoc(doc(db, "citas", cita.id), { estado: nuevoEstado });
    setMenuAbierto(null);
  };

  if (cargandoPerfil) return <div className="loading">Cargando perfil...</div>;

  return (
    <div
      className="panel-container"
    >
      <Barra
        onVistaChange={setActiveVista}
        activeVista={activeVista}
        vistas={VISTAS}
        rol={perfilUsuario?.rol}
      />

        {activeVista === VISTAS.CITAS && (
          <Citas
            menuAbierto={menuAbierto}
            setMenuAbierto={setMenuAbierto}
            borrarCita={(id) => deleteDoc(doc(db, "citas", id))}
            gestionarCita={gestionarCita}
            citas={citasAgenda}
          />
        )}
        {activeVista === VISTAS.HORARIO && (
          <Horarios
            perfilUsuario={perfilUsuario}
            fechaBloqueo={fechaBloqueo}
            setFechaBloqueo={setFechaBloqueo}
            bloqueos={bloqueos}
            toggleBloqueo={toggleBloqueo}
            citas={citasAgenda}
          />
        )}
        {activeVista === VISTAS.SERVICIOS &&
          (esAdmin ? (
            <GestionServicios />
          ) : (
            <div className="aviso">Acceso restringido.</div>
          ))}

    </div>
  );
};

export default PanelAdminMobile;
