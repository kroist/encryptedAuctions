import { Header } from "../components/Header";
import { ItemList } from "../components/ItemList";
import { CreateButton } from "../components/CreateButton";
import { mockUser, mockItems } from "../mock/data";

export function HomePage() {
  return (
    <>
      <Header user={mockUser} />
      <main>
        <ItemList items={mockItems} />
      </main>
      <CreateButton />
    </>
  );
}
