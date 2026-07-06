"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import {
  getResourceSourceLabel,
  getResourceTypeLabel,
  isExternalResourceHref
} from "../../lib/resource-display";
import type { Resource } from "../../content/resources";
import styles from "./resource-list.module.css";

type ResourceListProps = {
  resources: Resource[];
  title: string;
  emptyMessage: string;
  searchable?: boolean;
};

export function ResourceList({
  resources,
  title,
  emptyMessage,
  searchable = true
}: ResourceListProps) {
  const [query, setQuery] = useState("");
  const titleId = useId();

  const visibleResources = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);

    if (!normalizedQuery) {
      return resources;
    }

    return resources.filter((resource) => {
      const typeLabel = getResourceTypeLabel(resource.type);
      const sourceLabel = getResourceSourceLabel(resource.source);
      const haystack = [
        resource.title,
        resource.description,
        resource.type,
        typeLabel,
        resource.source,
        sourceLabel,
        resource.date ?? "",
        ...resource.tags
      ]
        .map(normalizeSearchText)
        .join(" ");

      return haystack.includes(normalizedQuery);
    });
  }, [query, resources]);

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <div className={styles.header}>
        <h2 className={styles.title} id={titleId}>
          {title}
        </h2>
        <span aria-live="polite" className={styles.count}>
          {visibleResources.length}
        </span>
      </div>

      {searchable ? (
        <label className={styles.searchLabel}>
          <span>Search resources</span>
          <input
            className={styles.searchInput}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            value={query}
          />
        </label>
      ) : null}

      {visibleResources.length === 0 ? (
        <p className={styles.emptyState}>{emptyMessage}</p>
      ) : (
        <ul className={styles.list}>
          {visibleResources.map((resource) => (
            <li className={styles.item} key={`${resource.type}-${resource.href}`}>
              <ResourceLink resource={resource} />
              <p className={styles.description}>{resource.description}</p>
              <ResourceMeta resource={resource} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ResourceLink({ resource }: { resource: Resource }) {
  const external = isExternalResourceHref(resource.href);

  if (external) {
    return (
      <a className={styles.resourceLink} href={resource.href} rel="noreferrer" target="_blank">
        {resource.title}
      </a>
    );
  }

  return (
    <Link className={styles.resourceLink} href={resource.href}>
      {resource.title}
    </Link>
  );
}

function ResourceMeta({ resource }: { resource: Resource }) {
  const parts = [
    getResourceTypeLabel(resource.type),
    getResourceSourceLabel(resource.source),
    ...resource.tags,
    resource.date ?? ""
  ].filter(Boolean);

  return <p className={styles.meta}>{parts.join(" · ")}</p>;
}

function normalizeSearchText(input: string): string {
  return input
    .normalize("NFKD")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
