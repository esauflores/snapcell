# %% [1] Clean
x = 10
y = 20
z = x + y

# %% [2] Mutate (reassigns z, reads x/y from [1])
z = z * 2

# %% [3] Mutate again (reads z from [2])
z = z + 5

# %% [4] Print
print(f"x={x}, y={y}, z={z}")
