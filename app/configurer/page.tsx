import Configurator from "@/components/Configurator";
import Nav from "@/components/Nav";

export const metadata = { title: "Options — JustMyRide" };

export default function ConfigurerPage() {
  return (
    <main>
      <Nav link={{ href: "/#deposer", label: "Envoyer ma voiture" }} />
      <Configurator />
      <footer className="foot">© {new Date().getFullYear()} JustMyRide</footer>
    </main>
  );
}
