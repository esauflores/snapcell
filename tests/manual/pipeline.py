# %% [1] Setup
import json
import math
from dataclasses import dataclass

PI = math.pi
RADIUS = 5
MULTIPLIER = 2

# %% [2] Raw data
data = [1, 2, 3, 4, 5]
squared = [x**2 for x in data]

# %% [3] Compute
area = PI * RADIUS**2
circumference = 2 * PI * RADIUS

# %% [4] Scale
scaled = [x * MULTIPLIER for x in squared]
total = sum(scaled)


# %% [5] Dataclass
@dataclass
class Circle:
    radius: float


# %% [6] Build result
c = Circle(radius=RADIUS)
result = {
    "circle": c,
    "area": area,
    "circumference": circumference,
    "scaled_total": total,
}

# %% [7] Output
print(json.dumps(result, indent=2, default=str))

# %% [8] Summary
summary = f"""
Circle r={RADIUS}:
  Area: {area:.2f}
  Circumference: {circumference:.2f}
Total scaled: {total}
Data points: {len(data)}
"""
print(summary)
