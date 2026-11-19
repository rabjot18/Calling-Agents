# Retell model check: 2026-11-16
Rule: newest generation per provider, p50 ≤ 700 ms, tool-calling ≥ 0.93, not beta or low-sample.

| model | tier | p50 ms | ¢/min | avg | tools | instr | eligible |
|---|---|---|---|---|---|---|---|
| tell-1 (beta) | standard | 104 | 3.499998 | 0.944 | 0.954 | 0.886 |  |
| gpt-6-luna | fast | 270 | 0.640002 | 0.807 | 0.786 | 0.737 |  |
| gpt-5.6-luna | fast | 327 | 1.279998 | 0.869 | 0.880 | 0.783 |  |
| gpt-5.6-luna | standard | 329 | 0.640002 | 0.869 | 0.880 | 0.783 |  |
| gpt-4.1-mini | standard | 466 | 1.279998 | 0.829 | 0.873 | 0.726 |  |
| gpt-6-luna | standard | 489 | 0.319998 | 0.807 | 0.786 | 0.737 |  |
| gpt-5.6-terra | standard | 505 | 6.400002 | 0.901 | 0.894 | 0.833 |  |
| gpt-5.6-terra | fast | 506 | 12.799998 | 0.901 | 0.894 | 0.833 |  |
| gpt-4.1-mini | fast | 521 | 1.92 | 0.829 | 0.873 | 0.726 |  |
| gpt-6.1-terra | fast | 558 | 6.400002 | 0.924 | 0.937 | 0.871 | ✅ |
| gpt-6.1-terra | standard | 586 | 3.199998 | 0.924 | 0.937 | 0.871 | ✅ |
| claude-4.5-haiku | standard | 600 | 2.500002 | 0.828 | 0.885 | 0.711 |  |
| gemini-3.5-flash-lite | standard | 608 | 0.96 | 0.827 | 0.840 | 0.730 |  |
| gpt-5.4 | fast | 611 | 16.000002 | 0.896 | 0.917 | 0.818 |  |
| gpt-4.1 | standard | 619 | 4.5 | 0.846 | 0.897 | 0.734 |  |
| gpt-5.4-mini | fast | 620 | 4.8 | 0.779 | 0.761 | 0.682 |  |
| gpt-4.1 | fast | 626 | 6.75 | 0.846 | 0.897 | 0.734 |  |
| gpt-6-sol | standard | 630 | 6.400002 | 0.923 | 0.937 | 0.862 |  |
| gpt-5-mini | fast | 630 | 1.600002 | 0.750 | 0.765 | 0.660 |  |
| gpt-5 | fast | 649 | 7.999998 | 0.824 | 0.887 | 0.713 |  |
| gpt-5.1 | fast | 675 | 7.999998 | 0.815 | 0.866 | 0.709 |  |
| gpt-6.1-sol | ultrafast | 690 | 38.4 | 0.934 | 0.954 | 0.885 | ✅ |
| gpt-5.4-mini | standard | 691 | 2.4 | 0.779 | 0.761 | 0.682 |  |
| gemini-3.1-flash-lite | standard | 759 | 0.799998 | 0.826 | 0.874 | 0.722 |  |
| gpt-6-sol | fast | 768 | 12.799998 | 0.923 | 0.937 | 0.862 |  |
| gpt-5.4 | standard | 770 | 7.999998 | 0.896 | 0.917 | 0.818 |  |
| gpt-5.4-nano | standard | 780 | 0.640002 | 0.745 | 0.790 | 0.649 |  |
| gpt-5.2 | fast | 792 | 11.200002 | 0.832 | 0.886 | 0.748 |  |
| gpt-5-nano | standard | 794 | 0.160002 | 0.564 | 0.604 | 0.465 |  |
| gpt-6-astra | fast | 804 | 64.000002 | 0.931 | 0.946 | 0.897 |  |
| gpt-5.5 | fast | 808 | 31.999998 | 0.919 | 0.935 | 0.856 |  |
| claude-5.5-haiku | standard | 824 | 0.319998 | 0.854 | 0.900 | 0.724 |  |
| gpt-5.1 | standard | 825 | 4.000002 | 0.815 | 0.866 | 0.709 |  |
| claude-5.5-sonnet | standard | 829 | 6.400002 | 0.912 | 0.956 | 0.814 |  |
| gpt-5.2 | standard | 859 | 5.599998 | 0.832 | 0.886 | 0.748 |  |
| gemini-3.6-flash | standard | 892 | 2.4 | 0.870 | 0.900 | 0.780 |  |
| gpt-6.1-sol | fast | 899 | 12.799998 | 0.934 | 0.954 | 0.885 |  |
| gpt-5-mini | standard | 919 | 0.799998 | 0.750 | 0.765 | 0.660 |  |
| gpt-5.5 | standard | 937 | 16.000002 | 0.919 | 0.935 | 0.856 |  |
| gemini-3.5-flash | standard | 978 | 4.8 | 0.817 | 0.858 | 0.709 |  |
| claude-5-sonnet | standard | 1009 | 6.400002 | 0.874 | 0.925 | 0.744 |  |
| gpt-6.1-sol | standard | 1024 | 6.400002 | 0.934 | 0.954 | 0.885 |  |
| gpt-5 | standard | 1049 | 4.000002 | 0.824 | 0.887 | 0.713 |  |
| claude-4.6-sonnet | standard | 1062 | 7.999998 | 0.895 | 0.930 | 0.807 |  |
| gpt-6-astra | standard | 1081 | 31.999998 | 0.931 | 0.946 | 0.897 |  |
| claude-5-opus | standard | 1431 | 16.000002 | 0.904 | 0.927 | 0.809 |  |
| gemini-3.8-flash | standard | 1621 | 4.8 | 0.906 | 0.942 | 0.832 |  |
| gemini-3.7-flash | standard | 1797 | 4.8 | 0.888 | 0.925 | 0.817 |  |
| claude-5.5-opus | standard | 2229 | 12.799998 | 0.922 | 0.970 | 0.838 |  |
| gemini-4-argon | standard | 3474 | 12.799998 | 0.926 | 0.958 | 0.880 |  |

**Recommendation:** `{"primary": {"model": "gpt-6.1-terra", "tier": "fast"}, "backup": {"model": "gpt-5.6-luna", "tier": "fast", "kick_in_timeout_ms": 1500}, "pick_p50_ms": 558, "pick_cents_min": 6.400002}`
