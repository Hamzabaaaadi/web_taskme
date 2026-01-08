# Exemples Postman pour les endpoints Delegation

## Configuration de base
- **Base URL**: `http://localhost:5000/api/delegations`
- **Authentification**: Basic Auth (dans l'onglet Authorization de Postman)

---

## 1. Récupérer mes délégations (GET /me)

### Configuration
- **Méthode**: `GET`
- **URL**: `http://localhost:5000/api/delegations/me`

### Authorization
- **Type**: Basic Auth
- **Username**: Votre email (ex: `auditeur@example.com`)
- **Password**: Votre mot de passe

### Body
Aucun body requis

### Réponse attendue (200 OK)
```json
{
  "message": "Délégations récupérées avec succès",
  "count": 2,
  "delegations": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "affectationOriginale": {
        "_id": "...",
        "tacheId": "...",
        "auditeurId": "...",
        "statut": "EN_ATTENTE"
      },
      "auditeurInitial": {
        "nom": "Dupont",
        "prenom": "Jean",
        "email": "jean@example.com"
      },
      "auditeurPropose": {
        "nom": "Martin",
        "prenom": "Pierre",
        "email": "pierre@example.com"
      },
      "justification": "Raison de la délégation...",
      "statut": "EN_ATTENTE",
      "dateProposition": "2024-01-15T10:30:00.000Z",
      "dateReponse": null
    }
  ]
}
```

### Erreurs possibles
- **401**: Non authentifié
- **403**: Accès refusé (utilisateur n'est pas AUDITEUR)
- **500**: Erreur serveur

---

## 2. Accepter une délégation (PUT /:id/accepter)

### Configuration
- **Méthode**: `PUT`
- **URL**: `http://localhost:5000/api/delegations/507f1f77bcf86cd799439011/accepter`
  - Remplacez `507f1f77bcf86cd799439011` par l'ID MongoDB de la délégation

### Authorization
- **Type**: Basic Auth
- **Username**: Votre email (ex: `auditeur@example.com`)
- **Password**: Votre mot de passe

### Headers
```
Content-Type: application/json
```

### Body
Aucun body requis (ou body vide `{}`)

### Réponse attendue (200 OK)
```json
{
  "message": "Délégation acceptée avec succès",
  "delegation": {
    "_id": "507f1f77bcf86cd799439011",
    "affectationOriginale": {
      "_id": "...",
      "tacheId": "...",
      "auditeurId": "...",
      "statut": "EN_ATTENTE"
    },
    "auditeurInitial": {
      "nom": "Dupont",
      "prenom": "Jean",
      "email": "jean@example.com"
    },
    "auditeurPropose": {
      "nom": "Martin",
      "prenom": "Pierre",
      "email": "pierre@example.com"
    },
    "justification": "Raison de la délégation...",
    "statut": "ACCEPTEE",
    "dateProposition": "2024-01-15T10:30:00.000Z",
    "dateReponse": "2024-01-15T14:30:00.000Z"
  }
}
```

### Erreurs possibles
- **400**: Id requis ou délégation déjà traitée
- **401**: Non authentifié
- **403**: Accès refusé (pas AUDITEUR ou pas l'auditeurPropose)
- **404**: Délégation non trouvée
- **500**: Erreur serveur

---

## 3. Refuser une délégation (PUT /:id/refuser)

### Configuration
- **Méthode**: `PUT`
- **URL**: `http://localhost:5000/api/delegations/507f1f77bcf86cd799439011/refuser`
  - Remplacez `507f1f77bcf86cd799439011` par l'ID MongoDB de la délégation

### Authorization
- **Type**: Basic Auth
- **Username**: Votre email (ex: `auditeur@example.com`)
- **Password**: Votre mot de passe

### Headers
```
Content-Type: application/json
```

### Body
Aucun body requis (ou body vide `{}`)

### Réponse attendue (200 OK)
```json
{
  "message": "Délégation refusée avec succès",
  "delegation": {
    "_id": "507f1f77bcf86cd799439011",
    "affectationOriginale": {
      "_id": "...",
      "tacheId": "...",
      "auditeurId": "...",
      "statut": "EN_ATTENTE"
    },
    "auditeurInitial": {
      "nom": "Dupont",
      "prenom": "Jean",
      "email": "jean@example.com"
    },
    "auditeurPropose": {
      "nom": "Martin",
      "prenom": "Pierre",
      "email": "pierre@example.com"
    },
    "justification": "Raison de la délégation...",
    "statut": "REFUSEE",
    "dateProposition": "2024-01-15T10:30:00.000Z",
    "dateReponse": "2024-01-15T14:30:00.000Z"
  }
}
```

### Erreurs possibles
- **400**: Id requis ou délégation déjà traitée
- **401**: Non authentifié
- **403**: Accès refusé (pas AUDITEUR ou pas l'auditeurPropose)
- **404**: Délégation non trouvée
- **500**: Erreur serveur

---

## Instructions Postman

### Pour configurer Basic Auth dans Postman:
1. Ouvrez votre requête dans Postman
2. Allez dans l'onglet **Authorization**
3. Sélectionnez **Basic Auth** dans le menu déroulant "Type"
4. Entrez votre **Username** (email) et **Password**
5. Postman générera automatiquement le header `Authorization: Basic <base64>`

### Pour obtenir un ID de délégation:
1. Utilisez d'abord `GET /api/delegations/me` pour voir vos délégations
2. L'ID se trouve dans le champ `_id` de chaque délégation dans la réponse

### Exemple d'URL complète:
```
GET  http://localhost:5000/api/delegations/me
PUT  http://localhost:5000/api/delegations/507f1f77bcf86cd799439011/accepter
PUT  http://localhost:5000/api/delegations/507f1f77bcf86cd799439011/refuser
```

### Scénario de test complet:

1. **Étape 1**: Récupérer vos délégations
   - `GET /api/delegations/me`
   - Notez l'`_id` d'une délégation avec le statut `EN_ATTENTE`

2. **Étape 2**: Accepter une délégation
   - `PUT /api/delegations/{id}/accepter`
   - Vérifiez que le `statut` est maintenant `ACCEPTEE`
   - Vérifiez que `dateReponse` est rempli

3. **Étape 3**: Tester avec une autre délégation - Refuser
   - `PUT /api/delegations/{id}/refuser`
   - Vérifiez que le `statut` est maintenant `REFUSEE`
   - Vérifiez que `dateReponse` est rempli

4. **Étape 4**: Tester les erreurs
   - Essayer d'accepter/refuser une délégation déjà traitée → devrait retourner 400
   - Essayer avec un ID invalide → devrait retourner 404
   - Essayer avec un utilisateur qui n'est pas l'auditeurPropose → devrait retourner 403

---

## Collection Postman (JSON)

Vous pouvez importer cette collection dans Postman:

```json
{
  "info": {
    "name": "Delegation API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get My Delegations",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "http://localhost:5000/api/delegations/me",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5000",
          "path": ["api", "delegations", "me"]
        },
        "auth": {
          "type": "basic",
          "basic": [
            {
              "key": "username",
              "value": "auditeur@example.com",
              "type": "string"
            },
            {
              "key": "password",
              "value": "votremotdepasse",
              "type": "string"
            }
          ]
        }
      }
    },
    {
      "name": "Accept Delegation",
      "request": {
        "method": "PUT",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{}"
        },
        "url": {
          "raw": "http://localhost:5000/api/delegations/:id/accepter",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5000",
          "path": ["api", "delegations", ":id", "accepter"],
          "variable": [
            {
              "key": "id",
              "value": "507f1f77bcf86cd799439011"
            }
          ]
        },
        "auth": {
          "type": "basic",
          "basic": [
            {
              "key": "username",
              "value": "auditeur@example.com",
              "type": "string"
            },
            {
              "key": "password",
              "value": "votremotdepasse",
              "type": "string"
            }
          ]
        }
      }
    },
    {
      "name": "Refuse Delegation",
      "request": {
        "method": "PUT",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{}"
        },
        "url": {
          "raw": "http://localhost:5000/api/delegations/:id/refuser",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5000",
          "path": ["api", "delegations", ":id", "refuser"],
          "variable": [
            {
              "key": "id",
              "value": "507f1f77bcf86cd799439011"
            }
          ]
        },
        "auth": {
          "type": "basic",
          "basic": [
            {
              "key": "username",
              "value": "auditeur@example.com",
              "type": "string"
            },
            {
              "key": "password",
              "value": "votremotdepasse",
              "type": "string"
            }
          ]
        }
      }
    }
  ]
}
```

---

## Notes importantes

⚠️ **Important**: 
- Vous devez être connecté avec un compte ayant le rôle `AUDITEUR`
- Vous ne pouvez accepter/refuser que les délégations où vous êtes l'`auditeurPropose`
- Vous ne pouvez modifier que les délégations avec le statut `EN_ATTENTE`
- Une fois acceptée ou refusée, une délégation ne peut plus être modifiée
