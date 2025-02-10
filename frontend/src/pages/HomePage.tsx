import { Header } from "../components/Header";
import { ItemList } from "../components/ItemList";
import { CreateButton } from "../components/CreateButton";

export function HomePage() {
  return (
    <>
      <Header />
      <main>
        <ItemList />
      </main>
      <CreateButton />
    </>
  );
}
