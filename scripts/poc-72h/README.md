# POC 72h — sourcing artifacts

Fichiers générés pendant l'exécution du plan GTM 72h.

## Inventaire

| # | Fichier | Source | Contenu |
|---|---------|--------|---------|
| 01 | `01-apollo-raw-companies.json` | Apollo `mixed_companies_search` page 1 | 94 orgs Shopify FR 11-50 employés |
| 02 | `02-orgs-cleaned.json` | Transformé depuis 01 | 94 orgs avec {apollo_id, name, domain, revenue, website, linkedin} |
| 03 | `03-dnvb-candidates.json` | Filtre manuel sur 02 | 67 DNVB candidats (médias/écoles/associations exclus) |

## Next steps

- Apollo `mixed_people_api_search` avec q_organization_domains_list = 67 domaines + titres décideur/opé CX
- Apollo `people_bulk_match` pour récupérer les emails
- Clay selectivement sur top 50 pour hooks personnalisés + Tech Stack final
- Push dans Notion database : https://www.notion.so/bd19faa4232a4581b5cc96a0a3652102
