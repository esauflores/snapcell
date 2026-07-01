# %% [1] Import
import pandas as pd

# %% [2] DataFrame
df = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})

# %% [3] Transform
df["c"] = df["a"] + df["b"]

# %% [4] Display
print(df)
