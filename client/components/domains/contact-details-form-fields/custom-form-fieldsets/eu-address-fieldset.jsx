/**
 * External dependencies
 */
import React from 'react';
import PropTypes from 'prop-types';
import { localize } from 'i18n-calypso';

/**
 * Internal dependencies
 */
import { Input } from 'calypso/my-sites/domains/components/form';

const noop = () => {};

const EuAddressFieldset = ( props ) => {
	const { getFieldProps, translate, contactDetailsErrors, arePostalCodesSupported } = props;
	return (
		<div className="custom-form-fieldsets__address-fields eu-address-fieldset">
			{ arePostalCodesSupported && (
				<Input
					label={ translate( 'Postal Code' ) }
					{ ...getFieldProps( 'postal-code', {
						customErrorMessage: contactDetailsErrors?.postalCode,
					} ) }
				/>
			) }
			<Input
				label={ translate( 'City' ) }
				{ ...getFieldProps( 'city', { customErrorMessage: contactDetailsErrors?.city } ) }
			/>
		</div>
	);
};

EuAddressFieldset.propTypes = {
	getFieldProps: PropTypes.func,
	translate: PropTypes.func,
	contactDetailsErrors: PropTypes.object,
	arePostalCodesSupported: PropTypes.bool,
};

EuAddressFieldset.defaultProps = {
	getFieldProps: noop,
	arePostalCodesSupported: true,
};

export default localize( EuAddressFieldset );
