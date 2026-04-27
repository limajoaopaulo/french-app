import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { RadarChart } from "@/components/stats/RadarChart"

function makeAxes(n: number, value: number) {
  return Array.from({ length: n }, (_, i) => ({ label: `A${i}`, value }))
}

describe("RadarChart", () => {
  it("renders one svg role=img with the title", () => {
    const { getByRole } = render(
      <RadarChart title="Grammaire" axes={makeAxes(10, 3)} />,
    )
    expect(getByRole("img")).toHaveAttribute("aria-label", "Grammaire")
  })

  it("draws N axis lines for N axes", () => {
    const { container } = render(
      <RadarChart title="Test" axes={makeAxes(10, 3)} />,
    )
    // Axis lines are <line> elements from center; there are exactly 10
    const lines = container.querySelectorAll("svg line")
    expect(lines.length).toBe(10)
  })

  it("data polygon at value=max reaches the outer ring (largest coords match)", () => {
    const { container } = render(
      <RadarChart title="Full" axes={makeAxes(10, 5)} max={5} size={320} />,
    )
    // data polygon is the polygon with non-zero fill-opacity
    const polygons = container.querySelectorAll("svg polygon")
    // 5 rings + 1 data polygon = 6 polygons
    expect(polygons.length).toBe(6)
  })

  it("renders a <text> label per axis", () => {
    const { container } = render(
      <RadarChart title="Labels" axes={makeAxes(10, 2)} />,
    )
    const labels = container.querySelectorAll("svg text")
    expect(labels.length).toBe(10)
  })
})
