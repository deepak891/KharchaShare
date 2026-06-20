# Splitwise Clone

A modern expense sharing application built with a **FastAPI** backend and a **React Native**/Expo frontend. The project allows groups to track shared expenses, calculate splits, and settle balances seamlessly.

---

## Project Overview

- **Backend**: FastAPI with SQLite, providing RESTful APIs for groups, expenses, and split calculations.
- **Frontend**: Expo + React Native with a tab‑based UI (Expenses, Settle, Profile). Utilises custom hooks for data fetching and state management.
- **Features**:
  - Create groups and add members.
  - Add expenses with optional parsing of free‑form text.
  - Automatic split calculation (equal, custom percentages).
  - View balances and settle debts.
  - Responsive UI components (avatars, cards, badges).

---

## Installation

### Prerequisites

- **Node.js** (>= 18) and **npm** or **yarn**
- **Python** (>= 3.9) and **pip**
- **Docker** (optional, for containerised development)
- **Expo CLI** (`npm i -g expo-cli`)

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/your-org/splitwise-clone.git
cd splitwise-clone/backend

# Create a virtual environment
python -m venv venv
source venv/bin/activate   # On Windows use `venv\Scripts\activate`

# Install dependencies
pip install -r requirements.txt

# Run the development server
uvicorn main:app --reload
```

The API will be available at `http://127.0.0.1:8000`.

### Frontend Setup

```bash
cd ../
# Install node dependencies
npm install   # or `yarn`

# Start the Expo development server
npx expo start
```

Scan the QR code with the Expo Go app or run on an emulator.

### Docker (Optional)

```bash
docker compose up --build
```

This will spin up both the backend (FastAPI) and a SQLite database container.

---

## Usage Examples

### Creating a Group (API)

```bash
curl -X POST http://127.0.0.1:8000/groups \
  -H "Content-Type: application/json" \
  -d '{"name": "Trip to Bali", "members": ["alice", "bob", "carol"]}'
```

### Adding an Expense (Frontend)

```tsx
import { useAddExpense } from '../hooks/useExpenseParsing';

const { addExpense } = useAddExpense();

addExpense({
  description: "Dinner at beachfront",
  amount: 120.0,
  paid_by: "alice",
  group_id: "group-id-123",
  split_type: "equal",
});
```

### Calculating Splits

The backend automatically calculates each member’s share based on the selected `split_type` (equal, percentage, custom). The response includes a list of `SplitResult` objects:

```json
[
  {"member": "alice", "amount": 40.0},
  {"member": "bob", "amount": 40.0},
  {"member": "carol", "amount": 40.0}
]
```

---

## Contribution Guidelines

1. **Fork the repository** and create a new branch for your feature or bug‑fix.
2. Follow the existing code style (Prettier for frontend, Black for backend).
3. Write unit tests for any new functionality. Backend tests live under `backend/tests/` and can be run with `pytest`.
4. Ensure all tests pass:
   ```bash
   cd backend && pytest
   ```
5. Update documentation (README, ADRs, or architecture docs) as needed.
6. Open a Pull Request with a clear description of the changes.

### Code of Conduct

Please be respectful and inclusive. See the `CODE_OF_CONDUCT.md` (if present) for details.

---

## License

This project is licensed under the MIT License – see the `LICENSE` file for details.
