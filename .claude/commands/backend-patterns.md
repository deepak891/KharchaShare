# Backend Patterns — KharchaShare

Reference guide for the Python FastAPI backend architecture.
Read this before adding or reviewing any backend code.

---

## Core Architecture

```
Request → Route Handler → Service (via Depends) → Repository/Parser
                                                         ↓
Response ← Route Handler ← Service ← Repository/Parser result
```

The route handler is a thin adapter. It:
1. Receives the validated Pydantic model
2. Calls the service/repository
3. Returns the result (Pydantic serialises it)
4. Catches exceptions → raises `HTTPException`

**Nothing else.** All logic lives in `services/`.

---

## SOLID Applied

### Single Responsibility
Each file has one reason to change:
- `schemas.py` — data shapes only
- `interfaces.py` — contracts only
- `expense_parser.py` — AI parsing only
- `split_calculator.py` — split math only
- `group_repository.py` — group persistence only
- `expense_repository.py` — expense persistence + balance calculation only
- `dependencies.py` — wiring only
- Route files — HTTP mapping only

### Open/Closed
Add a new split strategy by adding a new class — never edit `EqualSplitStrategy`.
Add a new parser (cloud, mock) by implementing `ExpenseParserProtocol` — never edit the existing parser.

### Dependency Inversion
Route handlers depend on `*Protocol` (abstract), never on `OllamaExpenseParser` (concrete).
`dependencies.py` is the only place that knows which concrete class backs each protocol.

---

## Protocol Pattern

```python
# interfaces.py — define the contract
class GroupRepositoryProtocol(Protocol):
    async def create(self, request: CreateGroupRequest) -> Group: ...
    async def list_all(self) -> list[Group]: ...

# group_repository.py — implement it
class InMemoryGroupRepository:
    async def create(self, request: CreateGroupRequest) -> Group:
        ...  # real implementation

# dependencies.py — wire it
_group_repository: GroupRepositoryProtocol = InMemoryGroupRepository()

def get_group_repository() -> GroupRepositoryProtocol:
    return _group_repository

# route handler — use it
@router.get("/groups", response_model=list[Group])
async def list_groups(
    repo: GroupRepositoryProtocol = Depends(get_group_repository),
) -> list[Group]:
    return await repo.list_all()
```

To swap implementations (e.g. SQLite): change only `dependencies.py`. Nothing else.

---

## Route Handler Template

```python
@router.post("/things", response_model=Thing, status_code=201)
async def create_thing(
    req: CreateThingRequest,
    repo: ThingRepositoryProtocol = Depends(get_thing_repository),
) -> Thing:
    try:
        return await repo.create(req)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not create thing: {exc}") from exc
```

**Rules:**
- `response_model=` always set — FastAPI validates output shape
- `status_code=201` for POST that creates a resource
- `try/except Exception` wraps the service call — never let service exceptions leak as 500s
- Return the service result directly — no transformation in the handler

---

## Schema Patterns

```python
class CreateThingRequest(BaseModel):
    name: str
    members: list[str]

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name cannot be empty")
        return v.strip()   # ← also normalise in validators

class Thing(BaseModel):
    id: str
    name: str
    created_at: datetime
    # computed/derived fields are included in the response model
    net_balance: float
```

**Rules:**
- All models in `backend/models/schemas.py` — single source of truth
- Request model: `Create*Request` — validates and normalises input
- Response model: the entity itself (`Group`, `Expense`, etc.)
- `@field_validator` for non-null, non-empty, positive number checks
- `datetime` fields: always `datetime.now(timezone.utc)` — never naive datetimes

---

## In-Memory Repository Pattern

```python
class InMemoryThingRepository:
    def __init__(self) -> None:
        self._things: dict[str, Thing] = {}

    async def create(self, req: CreateThingRequest) -> Thing:
        thing = Thing(
            id=str(uuid4()),
            created_at=datetime.now(timezone.utc),
            **req.model_dump(),
        )
        self._things[thing.id] = thing
        return thing

    async def list_all(self) -> list[Thing]:
        return sorted(self._things.values(), key=lambda t: t.created_at, reverse=True)
```

**Rules:**
- `dict[str, Model]` keyed by UUID string
- `model_dump()` to unpack request fields into the entity constructor
- Sort in the repository, not in the route handler
- `uuid4()` for IDs, `datetime.now(timezone.utc)` for timestamps

---

## Dependency Singleton vs Per-Request

```python
# Stateful (has in-memory state) → module-level singleton
_group_repository = InMemoryGroupRepository()

def get_group_repository() -> GroupRepositoryProtocol:
    return _group_repository  # same instance every request

# Stateless (no shared state) → new instance per request
def get_expense_parser(settings = Depends(get_settings)) -> ExpenseParserProtocol:
    return OllamaExpenseParser(client=..., model=settings.ollama_model)
```

---

## Testing Pattern

```python
# conftest.py — fake implementations
class FakeThingRepository:
    def __init__(self):
        self._things = {}
    async def create(self, req): ...
    async def list_all(self): ...

@pytest.fixture
def app():
    application = create_app()
    application.dependency_overrides[get_thing_repository] = lambda: FakeThingRepository()
    return application

@pytest.fixture
def client(app):
    return TestClient(app)

# test_api.py
def test_create_thing(client):
    res = client.post("/api/things", json={"name": "Test"})
    assert res.status_code == 201
    assert res.json()["name"] == "Test"
```

Override `dependency_overrides` in the `app` fixture — never monkey-patch.

---

## Common Mistakes to Avoid

| Wrong | Right |
|-------|-------|
| Business logic in route handler | Move to service/repository |
| `os.getenv()` scattered in code | Use `core/config.py` `Settings` |
| Instantiating services in route files | Use `Depends()` |
| Bare `except:` | `except Exception as exc:` with `from exc` |
| `datetime.now()` (naive) | `datetime.now(timezone.utc)` |
| Returning dicts from repositories | Return Pydantic models |
| Router prefix + path with duplicate `/api` | Prefix on router, path starts with `/` |
