"""
Interpolation, extrapolation, LOESS smoothing, and polynomial fitting.
"""
import numpy as np
from scipy.interpolate import interp1d
from scipy.signal import savgol_filter
from scipy.optimize import curve_fit


def polynomial_fit(x: list[float], y: list[float], degree: int) -> dict:
    """Fit a polynomial of given degree; return coefficients and fitted y values."""
    coeffs = np.polyfit(x, y, degree)
    poly = np.poly1d(coeffs)
    x_arr = np.array(x)
    return {
        "coefficients": coeffs.tolist(),
        "y_fitted": poly(x_arr).tolist(),
    }


def interpolate(x: list[float], y: list[float], x_query: list[float], kind: str = "linear") -> list[float]:
    """Interpolate y values at x_query positions."""
    f = interp1d(x, y, kind=kind, fill_value="extrapolate")
    return f(np.array(x_query)).tolist()


def loess_smooth(x: list[float], y: list[float], window_length: int | None = None, polyorder: int = 2) -> list[float]:
    """
    Apply Savitzky-Golay smoothing as an approximation of LOESS.
    window_length defaults to min(len(y)//3 | odd, len(y)).
    """
    n = len(y)
    if window_length is None:
        wl = max(5, n // 3)
        if wl % 2 == 0:
            wl += 1
        window_length = min(wl, n if n % 2 == 1 else n - 1)

    if window_length > n:
        window_length = n if n % 2 == 1 else n - 1

    y_arr = np.array(y, dtype=float)
    return savgol_filter(y_arr, window_length, polyorder).tolist()
