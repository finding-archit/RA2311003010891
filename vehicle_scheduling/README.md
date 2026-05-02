# Vehicle Maintenance Scheduler

Selects the optimal subset of maintenance tasks per depot to maximise total **Impact** within the available **MechanicHours** budget.

## Algorithm

**0/1 Knapsack (Dynamic Programming)**  
- Time complexity: O(n × W) where n = number of tasks, W = mechanic-hour budget  
- Space complexity: O(n × W)  
- Guarantees the globally optimal solution

## Results

| Depot | Budget (h) | Tasks Selected | Hours Used | Total Impact |
|-------|-----------|----------------|------------|-------------|
| 1     | 60        | 20             | 60         | 144         |
| 2     | 135       | 34             | 134        | 197         |
| 3     | 188       | 36             | 149        | 200         |
| 4     | 97        | 28             | 97         | 183         |
| 5     | 164       | 36             | 149        | 200         |

**Grand Total Impact: 924**

## How to Run

```bash
# from repo root
npm install
npx ts-node vehicle_scheduling/scheduler.ts
```

## Author

Archit Gupta — RA2311003010891
