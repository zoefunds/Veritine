import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { AdminClient } from './AdminClient';

// Deliberately no heading, no "Contract Administration" copy, nothing that
// identifies this route's purpose in the server-rendered shell - that part
// renders before we know whether the connected wallet is the owner, so
// anything said here is said to every visitor. AdminClient decides what,
// if anything, to reveal once ownership is actually confirmed client-side.
export default function AdminPage(): React.ReactElement {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-stack-lg max-w-[720px] mx-auto px-gutter-mobile md:px-margin-desktop min-h-[60vh]">
        <AdminClient />
      </main>
      <Footer />
    </>
  );
}
