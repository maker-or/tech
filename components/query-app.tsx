"use client"

import { FormEvent, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

type QueryResponse = {
  text: string
  toolResults?: unknown[]
}

export function QueryApp() {
  const [query, setQuery] = useState("")
  const [answer, setAnswer] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [theme, setTheme] = useState<"dark" | "light">("dark")

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme")
    const initialTheme = savedTheme === "light" ? "light" : "dark"
    setTheme(initialTheme)
    document.documentElement.classList.toggle("dark", initialTheme === "dark")
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark"
    setTheme(nextTheme)
    localStorage.setItem("theme", nextTheme)
    document.documentElement.classList.toggle("dark", nextTheme === "dark")
  }

  const submitQuery = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          model: "llama-3.3-70b-versatile",
        }),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || "Request failed")
      }

      const data = (await response.json()) as QueryResponse
      setAnswer(data.text || "No response generated.")
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong while querying.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Badge variant="outline">Groq + Vercel AI SDK</Badge>
              <CardTitle>Natural Language Query Console</CardTitle>
              <CardDescription>
                Single-shot query flow. Convex can keep threading/tooling on the
                backend while this UI stays minimal.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={toggleTheme}>
              {theme === "dark" ? "Switch to light" : "Switch to dark"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={submitQuery} className="space-y-3">
            <Textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Example: Show top 10 customers by revenue in Q4."
              disabled={isLoading}
              rows={6}
            />
            <div className="flex items-center justify-end">
              <Button type="submit" disabled={isLoading || query.trim().length === 0}>
                {isLoading ? "Running query..." : "Run query"}
              </Button>
            </div>
          </form>

          <Separator />

          <div className="space-y-2">
            <p className="text-muted-foreground text-xs">Result</p>
            <Card className="min-h-40 border">
              <CardContent className="py-4">
                {error ? (
                  <p className="text-destructive whitespace-pre-wrap text-sm">{error}</p>
                ) : (
                  <p className="whitespace-pre-wrap text-sm">
                    {answer || "No result yet. Submit a query to see output."}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
        <CardFooter className="text-muted-foreground text-xs">
          Database execution is intentionally a placeholder tool call in the API
          route. Swap that tool body with your real integration.
        </CardFooter>
      </Card>
    </main>
  )
}
