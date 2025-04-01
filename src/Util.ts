import * as Route53 from 'aws-cdk-lib/aws-route53';
import { RemoteParameters } from 'cdk-remote-stack';
import { Construct } from 'constructs';
import { Configuration } from './Configuration';
import { Statics } from './Statics';

/**
 * Will import the project hosted zone
 * @param scope
 * @param fromRegion
 * @returns project hosted zone
 */
export function importProjectHostedZone(scope: Construct, fromRegion: string) {
  const zoneParams = new RemoteParameters(scope, 'zone-params', {
    path: Statics.ssmZonePath,
    region: fromRegion,
  });
  return Route53.HostedZone.fromHostedZoneAttributes(scope, 'zone', {
    hostedZoneId: zoneParams.get(Statics.ssmZoneId),
    zoneName: zoneParams.get(Statics.ssmZoneName),
  });
}


export class AppDomainUtil {

  /**
   * Get a list of all domain names for this app
   * @param configuration
   * @param zoneName the project hosted zone name
   */
  static getDomainNames(configuration: Configuration, zoneName: string) {
    const cspName = zoneName;
    const nijmegenDomain = AppDomainUtil.getNijmegenDomainName(configuration);
    const domainNames = [cspName];
    if (nijmegenDomain) { domainNames.push(nijmegenDomain); }
    return domainNames;
  }

  static getAlternativeDomainNames(configuration: Configuration) {
    const nijmegenDomain = AppDomainUtil.getNijmegenDomainName(configuration);
    if (nijmegenDomain) {
      return [nijmegenDomain];
    }
    return undefined;
  }

  /**
   * Logic for determining the base url of this app
   * @param configuration
   * @param zoneName
   * @returns
   */
  static getBaseUrl(configuration: Configuration, zoneName: string) {
    if (configuration.nijmegenSubdomain) {
      return `https://${configuration.nijmegenSubdomain}.nijmegen.nl/`;
    }
    return `https://${zoneName}/`;
  }

  public static getNijmegenDomainName(configuration: Configuration) {
    if (configuration.nijmegenSubdomain) {
      return `${configuration.nijmegenSubdomain}.nijmegen.nl`;
    }
    return undefined;
  }

}


