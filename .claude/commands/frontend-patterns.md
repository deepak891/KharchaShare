# Frontend Patterns — KharchaShare

Reference guide for the React Native / Expo Router frontend architecture.
Read this before adding or reviewing any frontend code.

---

## Core Architecture

```
Backend JSON
    ↓
lib/api.ts          — one function per endpoint, typed with lib/types.ts
    ↓
hooks/use*.ts       — async state management (loading, error, data, reload)
    ↓
app/*.tsx            — screens: layout + UI only, no data logic
    ↓
components/*.tsx    — reusable visual pieces extracted from screens
```

**Rule:** Screens never call `fetch`. Hooks never render JSX. API functions never import from screens.

---

## File Ownership

| Concern | File | Rule |
|---------|------|------|
| TypeScript interfaces | `lib/types.ts` | All domain types here — nothing else |
| HTTP calls | `lib/api.ts` | All `fetch()` calls here — nothing else |
| Design tokens | `lib/theme.ts` | All colours, shadows, radii here |
| Shared constants | `lib/constants.ts` | MOCK_USER_NAME, EMOJI_OPTIONS, etc. |
| Async data + state | `hooks/use*.ts` | isLoading, error, data, reload |
| Screen layout + UX | `app/*.tsx` | Renders hooks' data — no logic |
| Shared visual pieces | `components/*.tsx` | Extracted from screens when used 2+ places |

---

## Type Pattern

```typescript
// lib/types.ts — mirrors backend Pydantic schemas exactly
export interface Group {
  id: string;
  name: string;
  emoji: string;
  color: string;       // hex
  members: string[];
  created_at: string;  // ISO 8601 — keep as string, parse in screen when needed
  net_balance: number; // positive = owed to you, negative = you owe
}
```

**Rules:**
- Property names match JSON wire format (snake_case from Python)
- `datetime` fields are `string` — don't use `Date` objects in types
- `export interface`, not `export type` for objects
- No `null` unless the backend actually sends null

---

## API Client Pattern

```typescript
// lib/api.ts
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getGroups(): Promise<Group[]> {
  return get<Group[]>(`/api/groups?user=${encodeURIComponent(MOCK_USER_NAME)}`);
}
```

**Rules:**
- `get<T>()` and `post<T>()` helpers — never write `fetch(...)` directly in an export
- Always `encodeURIComponent` for user-supplied strings in URLs
- Import `MOCK_USER_NAME` from `lib/constants` — never hardcode "Deepak" in the API layer
- Error shape from backend: `{ detail: string }` — extract `.detail`

---

## Hook Pattern

```typescript
// hooks/useGroups.ts
export function useGroups() {
  const [groups, setGroups]     = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]       = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      setGroups(await getGroups());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  return { groups, isLoading, error, reload: load };
}
```

**Rules:**
- Always return `{ data, isLoading, error, reload }` — these four, always
- `useFocusEffect` + `useCallback` — reload when screen gains focus
- `Promise.all` when loading multiple endpoints: `const [a, b] = await Promise.all([getA(), getB()])`
- Compute derived values inside the hook: `const myBalance = balances.find(...) ?? 0`
- `isLoading = true` on initial load AND on reload — screens show spinner both times

---

## Screen Pattern

```typescript
export default function MyScreen() {
  // 1. Params (if this is a pushed/modal screen)
  const { id, name, members: membersJson } = useLocalSearchParams<{...}>();
  const members = JSON.parse(membersJson) as string[];

  // 2. Data from hook
  const { data, isLoading, error, reload } = useMyHook(id);

  // 3. Render: loading → error → empty → content
  return (
    <SafeAreaView style={styles.safeArea}>
      {isLoading ? <LoadingView /> :
       error     ? <ErrorView error={error} onRetry={reload} /> :
       data.length === 0 ? <EmptyView /> :
       <ContentView data={data} />}
    </SafeAreaView>
  );
}
```

**Navigation params:** Pass complex objects as JSON strings, parse on arrival:
```typescript
// Pushing
router.push({
  pathname: '/my-screen',
  params: { id: item.id, members: JSON.stringify(item.members) }
});

// Receiving
const { members: membersJson } = useLocalSearchParams<{ members: string }>();
const members = JSON.parse(membersJson) as string[];
```

---

## Navigation Registration (`app/_layout.tsx`)

```typescript
<Stack.Screen name="my-screen"  options={{ headerShown: false, animation: 'slide_from_right' }} />
<Stack.Screen name="my-modal"   options={{ headerShown: false, animation: 'slide_from_bottom' }} />
```

- `slide_from_right` — for detail screens (push pattern)
- `slide_from_bottom` — for modal screens (add/create forms)
- Always `headerShown: false` — we build our own headers

---

## Theme Usage

```typescript
import { COLORS, RADIUS, SHADOW } from '../lib/theme';

// Correct
backgroundColor: COLORS.primary
borderRadius: RADIUS.lg
...SHADOW.card

// Wrong — never hardcode values
backgroundColor: '#5B5FEF'   // use COLORS.primary
borderRadius: 20              // use RADIUS.lg
```

**Colour semantics:**
- Buttons / active states → `COLORS.primary` (#5B5FEF indigo)
- Positive balance / success → `COLORS.success` (#22C55E green)
- Negative balance / error → `COLORS.danger` (#EF4444 red)
- Screen background → `COLORS.background`
- Card background → `COLORS.card`
- Borders / dividers → `COLORS.border`
- Primary text → `COLORS.text1`
- Secondary text → `COLORS.text2`
- Placeholder / disabled → `COLORS.text3`

---

## Component Extraction Rule

Extract to `components/` **only when**:
- The component is used in 2+ screens, OR
- The component has its own props interface + meaningful internal logic

Screen-local sub-components (single use) stay inline in the screen file as a plain function above the default export.

```typescript
// Inline sub-component — stays in the screen file
function ExpenseRow({ expense }: { expense: Expense }) {
  return <View>...</View>;
}

export default function GroupDetailScreen() {
  return <ExpenseRow expense={...} />;
}
```

---

## State Management Rules

- **No global state** (no Redux, no Zustand yet) — data is re-fetched on focus
- **No prop drilling beyond 2 levels** — pass via navigation params or refetch in child hook
- **No `useEffect` for data loading** — use `useFocusEffect` so data refreshes on screen focus
- **Error state is always `string | null`** — extract `.message` from Error objects

---

## Common Mistakes to Avoid

| Wrong | Right |
|-------|-------|
| `fetch(...)` in a screen or hook | Use `lib/api.ts` function |
| Hardcoded `#5B5FEF` in styles | `COLORS.primary` |
| `useEffect` for initial data load | `useFocusEffect` |
| Complex logic in screen JSX | Move to hook or inline helper function |
| `JSON.stringify` in the screen | Pass as param string when navigating |
| `new Date(iso)` in types | Keep as `string`, parse only in render |
| Checking `isLoading === false && error === null` | Use ternary chain: `isLoading ? ... : error ? ... : ...` |
